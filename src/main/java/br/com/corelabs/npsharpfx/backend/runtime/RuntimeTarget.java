/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.backend.runtime;

public final class RuntimeTarget {

    public enum Os {
        WINDOWS,
        LINUX,
        MACOS,
        ANDROID,
        UNKNOWN
    }

    public enum Arch {
        X64,
        ARM64,
        ARM32,
        UNKNOWN
    }

    private final Os os;
    private final Arch arch;

    private RuntimeTarget(Os os, Arch arch) {
        this.os = os;
        this.arch = arch;
    }

    public static RuntimeTarget detect() {
        String osName = System.getProperty("os.name", "").toLowerCase();
        String vmName = System.getProperty("java.vm.name", "").toLowerCase();
        String archName = System.getProperty("os.arch", "").toLowerCase();

        Os os;

        if (vmName.contains("dalvik") || osName.contains("android")) {
            os = Os.ANDROID;
        } else if (osName.contains("win")) {
            os = Os.WINDOWS;
        } else if (osName.contains("mac") || osName.contains("darwin")) {
            os = Os.MACOS;
        } else if (osName.contains("linux")) {
            os = Os.LINUX;
        } else {
            os = Os.UNKNOWN;
        }

        Arch arch;

        if (archName.contains("aarch64") || archName.contains("arm64")) {
            arch = Arch.ARM64;
        } else if (archName.contains("arm")) {
            arch = Arch.ARM32;
        } else if (archName.contains("amd64") || archName.contains("x86_64")) {
            arch = Arch.X64;
        } else {
            arch = Arch.UNKNOWN;
        }

        return new RuntimeTarget(os, arch);
    }

    public Os os() {
        return os;
    }

    public Arch arch() {
        return arch;
    }

    public String key() {
        return os.name().toLowerCase() + "-" + arch.name().toLowerCase();
    }
}