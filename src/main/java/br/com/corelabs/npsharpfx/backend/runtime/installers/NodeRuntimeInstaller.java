package br.com.corelabs.npsharpfx.backend.runtime.installers;

import java.nio.file.Path;

import br.com.corelabs.npsharpfx.backend.runtime.ArchiveExtractor;
import br.com.corelabs.npsharpfx.backend.runtime.DownloadService;
import br.com.corelabs.npsharpfx.backend.runtime.PlatformDetector;
import br.com.corelabs.npsharpfx.backend.runtime.RuntimeInfo;
import br.com.corelabs.npsharpfx.backend.runtime.RuntimeInstaller;
import br.com.corelabs.npsharpfx.backend.runtime.RuntimePackage;

public class NodeRuntimeInstaller implements RuntimeInstaller {

    private final Path root;

    public NodeRuntimeInstaller(Path root) {
        this.root = root;
    }

    @Override
    public RuntimePackage resolvePackage() {

        String platform = PlatformDetector.platform();

        return switch (platform) {

            case "windows-x64" -> new RuntimePackage(
                    "node",
                    "22.11.0",
                    "https://nodejs.org/dist/v22.11.0/node-v22.11.0-win-x64.zip",
                    "node.zip",
                    "node-v22.11.0-win-x64/node.exe"
            );

            default -> throw new IllegalStateException(
                    "Node não suportado: " + platform
            );
        };
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
                root.resolve("runtimes/node");

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