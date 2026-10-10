package com.bemastery.app;

import android.content.Intent;
import android.net.Uri;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;

import androidx.browser.customtabs.CustomTabsIntent;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

/**
 * BE Mastery — native sign-in for the Android shell (10 Oct 2026). The Android twin of
 * mobile/ios/.../BEAuthPlugin.swift: same jsName ("BEAuth"), same answers, so
 * index.html's fbSocial() drives both. The plugin only fetches a Google ID token;
 * the page turns it into the Firebase session (GoogleAuthProvider.credential →
 * signInWithCredential), exactly as on iPhone — no second session store.
 *
 * Google: Credential Manager's "Sign in with Google" sheet. The Android OAuth clients
 * (package + the Play signing and upload SHA-1s) live in the PRODUCTION Firebase
 * project be-mastery, so the server client id is be-mastery's web client
 * (res/values/strings.xml be_google_web_client_id). A staging build signs in to
 * be-mastery-test, whose Google provider must list that client id under "Safelist
 * client IDs from external projects" (docs/ANDROID_NATIVE_SHELL_PLAN.md).
 *
 * Apple: Android has no native Apple sign-in, so Apple's own page opens in a browser
 * tab (Custom Tab) for the Services ID com.lomonec.bemastery.signin, with
 * redirect_uri = https://auth.lomonec.com/__/auth/handler (already a return URL of the
 * Services ID). The proxy there (backend/auth-proxy) recognises our "bea." state and
 * hands Apple's answer back through bemastery://apple. The nonce Apple signs is the
 * SHA-256 of a raw nonce only this app knows, and Firebase checks it — exactly the
 * iPhone's rule — so a token caught on the way is useless to anyone else.
 */
@CapacitorPlugin(name = "BEAuth")
public class BEAuthPlugin extends Plugin {

    private String webClientId() {
        try { return getContext().getString(R.string.be_google_web_client_id).trim(); }
        catch (Exception e) { return ""; }
    }

    @PluginMethod
    public void available(PluginCall call) {
        JSObject r = new JSObject();
        r.put("apple", !appleServicesId().isEmpty());
        r.put("google", !webClientId().isEmpty());
        call.resolve(r);
    }

    @PluginMethod
    public void googleSignIn(PluginCall call) {
        String id = webClientId();
        if (id.isEmpty()) { call.reject("Google sign-in is not configured in this build.", "unconfigured"); return; }
        if (getActivity() == null) { call.reject("no activity", "provider"); return; }
        GetSignInWithGoogleOption opt = new GetSignInWithGoogleOption.Builder(id).build();
        GetCredentialRequest req = new GetCredentialRequest.Builder().addCredentialOption(opt).build();
        CredentialManager cm = CredentialManager.create(getContext());
        cm.getCredentialAsync(getActivity(), req, new CancellationSignal(), ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse res) {
                    Credential c = res.getCredential();
                    if (!(c instanceof CustomCredential) || !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(c.getType())) {
                        call.reject("unexpected credential", "provider");
                        return;
                    }
                    try {
                        GoogleIdTokenCredential g = GoogleIdTokenCredential.createFrom(((CustomCredential) c).getData());
                        JSObject r = new JSObject();
                        r.put("idToken", g.getIdToken());
                        if (g.getGivenName() != null) r.put("givenName", g.getGivenName());
                        call.resolve(r);
                    } catch (Exception e) {
                        call.reject("could not read the Google credential", "provider");
                    }
                }

                @Override
                public void onError(@NonNull GetCredentialException e) {
                    if (e instanceof GetCredentialCancellationException) call.reject("cancelled", "cancelled");
                    else if (e instanceof NoCredentialException) call.reject("no Google account on this phone", "provider");
                    else if (String.valueOf(e.getType()).toLowerCase().contains("interrupted")) call.reject("network", "network");
                    else call.reject(String.valueOf(e.getMessage()), "provider");
                }
            });
    }

    /* ---------------- Sign in with Apple (browser tab) ---------------- */

    private static final String APPLE_REDIRECT = "https://auth.lomonec.com/__/auth/handler";
    private static PluginCall appleCall;
    private static String appleState, appleRawNonce;
    private static boolean appleAway;

    private String appleServicesId() {
        try { return getContext().getString(R.string.be_apple_services_id).trim(); }
        catch (Exception e) { return ""; }
    }

    private static String random(int n) {
        String a = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";
        byte[] b = new byte[n]; new SecureRandom().nextBytes(b);
        StringBuilder sb = new StringBuilder(n);
        for (byte x : b) sb.append(a.charAt((x & 0xff) % a.length()));
        return sb.toString();
    }

    private static String sha256Hex(String s) throws Exception {
        byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte x : d) sb.append(String.format("%02x", x));
        return sb.toString();
    }

    @PluginMethod
    public void appleSignIn(PluginCall call) {
        String sid = appleServicesId();
        if (sid.isEmpty()) { call.reject("Sign in with Apple is not configured in this build.", "unconfigured"); return; }
        if (getActivity() == null) { call.reject("no activity", "provider"); return; }
        synchronized (BEAuthPlugin.class) {
            if (appleCall != null) appleCall.reject("cancelled", "cancelled");   // a second tap replaces the first
            appleRawNonce = random(32);
            appleState = "bea." + random(32);
            appleCall = call;
            appleAway = false;
        }
        try {
            Uri u = Uri.parse("https://appleid.apple.com/auth/authorize").buildUpon()
                .appendQueryParameter("client_id", sid)
                .appendQueryParameter("redirect_uri", APPLE_REDIRECT)
                .appendQueryParameter("response_type", "code id_token")
                .appendQueryParameter("response_mode", "form_post")
                .appendQueryParameter("scope", "name email")
                .appendQueryParameter("state", appleState)
                .appendQueryParameter("nonce", sha256Hex(appleRawNonce))
                .build();
            new CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(getActivity(), u);
        } catch (Exception e) {
            synchronized (BEAuthPlugin.class) { appleCall = null; }
            call.reject("could not open Apple's sign-in page", "provider");
        }
    }

    /** bemastery://apple?state=…&id_token=…[&user=…][&error=…] — from MainActivity. */
    static boolean deliverApple(Intent intent) {
        Uri d = intent == null ? null : intent.getData();
        if (d == null || !"bemastery".equals(d.getScheme()) || !"apple".equals(d.getHost())) return false;
        intent.setData(null);                                   // a rotation must not replay it
        PluginCall call; String rawNonce;
        synchronized (BEAuthPlugin.class) {
            call = appleCall; rawNonce = appleRawNonce;
            boolean mine = appleState != null && appleState.equals(d.getQueryParameter("state"));
            if (call == null || !mine) return true;            // not the sign-in we started: ignore it
            appleCall = null; appleState = null; appleRawNonce = null;
        }
        String err = d.getQueryParameter("error"), tok = d.getQueryParameter("id_token");
        if (err != null) { call.reject("cancelled", "user_cancelled_authorize".equals(err) ? "cancelled" : "provider"); return true; }
        if (tok == null || tok.isEmpty()) { call.reject("no identity token", "provider"); return true; }
        JSObject r = new JSObject();
        r.put("idToken", tok);
        r.put("rawNonce", rawNonce);
        try {
            String user = d.getQueryParameter("user");
            if (user != null) {
                JSONObject n = new JSONObject(user).optJSONObject("name");
                if (n != null && !n.optString("firstName").isEmpty()) r.put("givenName", n.optString("firstName"));
            }
        } catch (Exception ignored) { }
        call.resolve(r);
        return true;
    }

    /* The learner closed the tab (or pressed back) without finishing: nothing comes back,
       so returning to the app with the sign-in still open means "cancelled". */
    @Override
    protected void handleOnPause() { synchronized (BEAuthPlugin.class) { if (appleCall != null) appleAway = true; } }

    @Override
    protected void handleOnResume() {
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            PluginCall c = null;
            synchronized (BEAuthPlugin.class) {
                if (appleCall != null && appleAway) { c = appleCall; appleCall = null; appleState = null; appleRawNonce = null; }
            }
            if (c != null) c.reject("cancelled", "cancelled");
        }, 1500);
    }
}
