/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.ui.theme;

import java.util.ArrayList;
import java.util.List;

/**
 * Representa o conteúdo do package.json de uma extensão de tema do VSCode.
 *
 * Exemplo real de package.json:
 *
 * {
 *   "name": "zimniy-biryuza-theme",
 *   "displayName": "Zimniy Biryuza",
 *   "description": "Light turquoise theme",
 *   "version": "1.0.0",
 *   "publisher": "someone",
 *   "contributes": {
 *     "themes": [
 *       {
 *         "label": "Zimniy Biryuza",
 *         "uiTheme": "vs",
 *         "path": "./themes/zimniy-biryuza.json"
 *       }
 *     ]
 *   }
 * }
 *
 * Essa classe representa esse JSON inteiro.
 */
public class VSCodeThemePackage {

    /**
     * Nome interno da extensão.
     *
     * Exemplo:
     * "zimniy-biryuza-theme"
     */
    private String name;

    /**
     * Nome amigável mostrado ao usuário.
     */
    private String displayName;

    /**
     * Descrição da extensão.
     */
    private String description;

    /**
     * Versão da extensão.
     */
    private String version;

    /**
     * Nome do publisher da extensão.
     */
    private String publisher;

    /**
     * Seção "contributes" do package.json
     * onde ficam registradas as contribuições da extensão.
     *
     * No caso de temas:
     * contributes.themes
     */
    private final Contributes contributes = new Contributes();

    public String getName() {
        return name;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }

    public String getVersion() {
        return version;
    }

    public String getPublisher() {
        return publisher;
    }

    public Contributes getContributes() {
        return contributes;
    }

    /**
     * Classe que representa a seção "contributes".
     *
     * Exemplo:
     *
     * "contributes": {
     *     "themes": [...]
     * }
     */
    public static class Contributes {

        /**
         * Lista de temas que a extensão adiciona.
         */
        private final List<VSCodeThemeEntry> themes = new ArrayList<>();
        private final List<VSCodeThemeEntry> specialThemes = new ArrayList<>();

        public List<VSCodeThemeEntry> getThemes() {
            return themes == null ? List.of() : themes;
        }

        public List<VSCodeThemeEntry> getSpecialThemes() {
            return specialThemes == null ? List.of() : specialThemes;
        }
    }
}
