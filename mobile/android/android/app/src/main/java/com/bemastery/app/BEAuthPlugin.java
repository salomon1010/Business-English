package com.bemastery.app;

import android.os.CancellationSignal;

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
 * Apple: not offered on Android yet (available() answers apple:false), so the page
 * shows one button, never a broken second one.
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
        r.put("apple", false);
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

    @PluginMethod
    public void appleSignIn(PluginCall call) {
        call.reject("Sign in with Apple is not available in the Android app yet.", "unconfigured");
    }
}
