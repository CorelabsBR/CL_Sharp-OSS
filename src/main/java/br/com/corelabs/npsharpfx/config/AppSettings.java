/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.config;

public class AppSettings {
    public String theme = "np-dark";
    public String iconTheme = "default";
    public String iconColor = "";

    public String wallpaperPath = "";
    public double wallpaperOpacity = 0.18;

    public String editorFontFamily = "JetBrains Mono";
    public int editorFontSize = 14;
    public int editorTabSize = 4;
    public boolean editorWordWrap = false;
    public boolean editorLineNumbers = true;
    public boolean editorAutoSave = false;
    public boolean editorFormatOnSave = false;

    public boolean terminalEnabled = true;
    public String terminalShellLinux = "/bin/bash";
    public String terminalShellWindows = "powershell.exe";
    public String terminalInitialDirectory = "";

    public boolean diagnosticsEnabled = true;
    public boolean errorLensEnabled = true;
    public boolean compileOnSave = false;
    public boolean problemsAutoOpen = true;

    public String buildCommand = "mvn -q -DskipTests compile";
    public boolean buildSkipTests = true;

    public boolean statusBarVisible = true;
    public boolean activityBarVisible = true;
    public boolean sideBarVisible = true;
}