/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */


/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.backend.engine.search.util;

import java.nio.file.Path;
import java.util.Locale;

public class SearchableFileFilter {

    public boolean isSearchableFile(Path file) {
        String name = file.getFileName().toString().toLowerCase(Locale.ROOT);

        if (name.equals(".ds_store")) return false;
        if (name.endsWith(".class")) return false;
        if (name.endsWith(".jar")) return false;
        if (name.endsWith(".png")) return false;
        if (name.endsWith(".jpg")) return false;
        if (name.endsWith(".jpeg")) return false;
        if (name.endsWith(".gif")) return false;
        if (name.endsWith(".webp")) return false;
        if (name.endsWith(".ico")) return false;
        if (name.endsWith(".pdf")) return false;
        if (name.endsWith(".zip")) return false;
        if (name.endsWith(".tar")) return false;
        if (name.endsWith(".gz")) return false;
        if (name.endsWith(".7z")) return false;
        if (name.endsWith(".mp3")) return false;
        if (name.endsWith(".mp4")) return false;
        if (name.endsWith(".wav")) return false;
        if (name.endsWith(".exe")) return false;
        if (name.endsWith(".dll")) return false;
        if (name.endsWith(".so")) return false;
        if (name.endsWith(".bin")) return false;

        String fullPath = file.toString().replace('\\', '/').toLowerCase(Locale.ROOT);
        return !fullPath.contains("/.git/") &&
               !fullPath.contains("/.hg/") &&
               !fullPath.contains("/.svn/") &&
               !fullPath.contains("/.idea/") &&
               !fullPath.contains("/.gradle/") &&
               !fullPath.contains("/.settings/") &&
               !fullPath.contains("/target/") &&
               !fullPath.contains("/build/") &&
               !fullPath.contains("/node_modules/") &&
               !fullPath.contains("/dist/") &&
               !fullPath.contains("/out/") &&
               !fullPath.contains("/bin/") &&
               !fullPath.contains("/obj/") &&
               !fullPath.contains("/vendor/") &&
               !fullPath.contains("/coverage/");
    }
}
