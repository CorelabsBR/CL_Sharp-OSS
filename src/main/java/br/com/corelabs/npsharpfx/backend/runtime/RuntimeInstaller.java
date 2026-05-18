package br.com.corelabs.npsharpfx.backend.runtime;

public interface RuntimeInstaller {

    RuntimePackage resolvePackage();

    RuntimeInfo install() throws Exception;
}