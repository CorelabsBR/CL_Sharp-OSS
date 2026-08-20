package br.com.corelabs.npsharp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NpsharpTerminalPlugin.class);
        registerPlugin(NpsharpWorkspacePlugin.class);
        registerPlugin(NpsharpGitPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
