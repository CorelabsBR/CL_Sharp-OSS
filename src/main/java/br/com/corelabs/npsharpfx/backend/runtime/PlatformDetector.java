package br.com.corelabs.npsharpfx.backend.runtime;

public final class PlatformDetector {

    public static String platform() {
        return os() + "-" + arch();
    }

    public static String os() {
        String os = System.getProperty("os.name").toLowerCase();

        if (os.contains("win")) return "windows";
        if (os.contains("linux")) return "linux";
        if (os.contains("mac")) return "macos";

        throw new IllegalStateException("OS não suportado: " + os);
    }

    public static String arch() {
        String arch = System.getProperty("os.arch").toLowerCase();

        if (arch.equals("amd64") || arch.equals("x86_64")) {
            return "x64";
        }

        if (arch.equals("aarch64") || arch.equals("arm64")) {
            return "arm64";
        }

        throw new IllegalStateException("Arquitetura não suportada: " + arch);
    }
}