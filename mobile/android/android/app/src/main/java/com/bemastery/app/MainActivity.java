package com.bemastery.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // the app's own plugins, registered before the bridge starts (as BEBridgeViewController does on iOS)
        registerPlugin(BEAdsPlugin.class);
        registerPlugin(BEPlayBillingPlugin.class);
        registerPlugin(BEPushPlugin.class);
        registerPlugin(BEAuthPlugin.class);
        registerPlugin(BEWidgetPlugin.class);
        super.onCreate(savedInstanceState);
        BEPushPlugin.deliverTap(getIntent());   // launched from a notification
        BEAuthPlugin.deliverApple(getIntent());
        BEWidgetPlugin.deliver(getIntent());    // launched from a home-screen widget (bemastery://open)
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        BEPushPlugin.deliverTap(intent);         // a notification tapped while the app was running
        BEAuthPlugin.deliverApple(intent);       // back from Sign in with Apple (this app's own scheme)
        BEWidgetPlugin.deliver(intent);          // a widget tapped while the app was running
    }

    /* the streak countdown re-reads the stored snapshot when the learner comes back and
       a few seconds after they leave (the page publishes on hide), as the TWA's LauncherActivity did */
    @Override
    public void onRestart() {
        super.onRestart();
        com.bemastery.app.widget.BEStreakCountdown.schedule(this, 5000L);
    }

    @Override
    public void onStop() {
        super.onStop();
        com.bemastery.app.widget.BEStreakCountdown.schedule(this, 8000L);
    }
}
