package br.com.corelabs.npsharp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(NpsharpTerminalPlugin.class);
        registerPlugin(NpsharpWorkspacePlugin.class);
    }
}
