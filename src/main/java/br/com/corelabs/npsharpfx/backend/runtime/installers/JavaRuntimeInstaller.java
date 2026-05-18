package br.com.corelabs.npsharpfx.backend.runtime.installers;

import java.nio.file.Path;

import br.com.corelabs.npsharpfx.backend.runtime.ArchiveExtractor;
import br.com.corelabs.npsharpfx.backend.runtime.DownloadService;
import br.com.corelabs.npsharpfx.backend.runtime.RuntimeInfo;
import br.com.corelabs.npsharpfx.backend.runtime.RuntimeInstaller;
import br.com.corelabs.npsharpfx.backend.runtime.RuntimePackage;

public class JavaRuntimeInstaller implements RuntimeInstaller {

    private final Path root;

    public JavaRuntimeInstaller(Path root) {
        this.root = root;
    }

    @Override
    public RuntimePackage resolvePackage() {

        return new RuntimePackage(
                "java",
                "21",
                "https://download.oracle.com/java/21/latest/jdk-21_windows-x64_bin.zip",
                "java.zip",
                "jdk-21/bin/java.exe"
        );
    }

    @Override
    public RuntimeInfo install() throws Exception {

        RuntimePackage pkg = resolvePackage();

        DownloadService downloader =
                new DownloadService();

        ArchiveExtractor extractor =
                new ArchiveExtractor();

        Path downloads =
                root.resolve("downloads");

        Path archive =
                downloads.resolve(pkg.archiveName());

        downloader.download(pkg.url(), archive);

        Path runtimeDir =
                root.resolve("runtimes/java");

        extractor.extract(archive, runtimeDir);

        Path executable =
                runtimeDir.resolve(pkg.executableRelativePath());

        return new RuntimeInfo(
                pkg.id(),
                pkg.version(),
                executable
        );
    }
}