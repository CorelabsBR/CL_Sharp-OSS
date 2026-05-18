package br.com.corelabs.npsharpfx.backend.runtime.installers;

import java.nio.file.Path;

import br.com.corelabs.npsharpfx.backend.runtime.ArchiveExtractor;
import br.com.corelabs.npsharpfx.backend.runtime.DownloadService;
import br.com.corelabs.npsharpfx.backend.runtime.RuntimeInfo;
import br.com.corelabs.npsharpfx.backend.runtime.RuntimeInstaller;
import br.com.corelabs.npsharpfx.backend.runtime.RuntimePackage;

public class PythonRuntimeInstaller implements RuntimeInstaller {

    private final Path root;

    public PythonRuntimeInstaller(Path root) {
        this.root = root;
    }

    @Override
    public RuntimePackage resolvePackage() {

        return new RuntimePackage(
                "python",
                "3.12.7",
                "https://www.python.org/ftp/python/3.12.7/python-3.12.7-embed-amd64.zip",
                "python.zip",
                "python.exe"
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
                root.resolve("runtimes/python");

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