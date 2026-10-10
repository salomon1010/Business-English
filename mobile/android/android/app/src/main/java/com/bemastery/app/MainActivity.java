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
        super.onCreate(savedInstanceState);
        BEPushPlugin.deliverTap(getIntent());   // launched from a notification
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        BEPushPlugin.deliverTap(intent);         // a notification tapped while the app was running
    }
}
