package br.com.corelabs.sharp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SharpTerminalPlugin.class);
        registerPlugin(SharpWorkspacePlugin.class);
        registerPlugin(SharpGitPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
