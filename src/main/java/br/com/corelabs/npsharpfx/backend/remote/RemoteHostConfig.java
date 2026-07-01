/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.backend.remote;

public class RemoteHostConfig {
    private String name = "";
    private String host = "";
    private int port = 22;
    private String username = "";
    private String authMethod = "password";
    private String privateKeyPath = "";
    private String defaultPath = ".";

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getHost() { return host; }
    public void setHost(String host) { this.host = host; }
    public int getPort() { return port <= 0 ? 22 : port; }
    public void setPort(int port) { this.port = port; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getAuthMethod() { return authMethod == null ? "password" : authMethod; }
    public void setAuthMethod(String authMethod) { this.authMethod = authMethod; }
    public String getPrivateKeyPath() { return privateKeyPath; }
    public void setPrivateKeyPath(String privateKeyPath) { this.privateKeyPath = privateKeyPath; }
    public String getDefaultPath() { return defaultPath == null || defaultPath.isBlank() ? "." : defaultPath; }
    public void setDefaultPath(String defaultPath) { this.defaultPath = defaultPath; }

    public String displayName() {
        return name == null || name.isBlank() ? username + "@" + host : name;
    }
}
