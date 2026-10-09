package com.bemastery.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // the app's own plugins, registered before the bridge starts (as BEBridgeViewController does on iOS)
        registerPlugin(BEAdsPlugin.class);
        registerPlugin(BEPlayBillingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
