package com.athlos.app;

import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Fondo negro para evitar barra blanca al hacer overscroll
        getWindow().getDecorView().setBackgroundColor(Color.parseColor("#09090b"));
        getWindow().setStatusBarColor(Color.parseColor("#09090b"));
        getWindow().setNavigationBarColor(Color.parseColor("#09090b"));

        // Desactivar overscroll glow en el WebView
        getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
        getBridge().getWebView().setBackgroundColor(Color.parseColor("#09090b"));
    }
}
