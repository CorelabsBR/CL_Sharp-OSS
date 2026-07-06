/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.ui.theme;

import java.util.ArrayList;
import java.util.List;

/**
 * Representa uma entrada de tema definida no package.json.
 *
 * Essa classe corresponde diretamente à estrutura JSON usada
 * pelos temas do VSCode.
 *
 * Exemplo de entrada no package.json:
 *
 * {
 *   "id": "vscode-dark",
 *   "label": "VSCode Dark",
 *   "uiTheme": "vs-dark",
 *   "path": "vscode-dark.json"
 * }
 *
 * Fluxo do sistema:
 *
 * package.json
 *      ↓
 * ThemePackageLoader
 *      ↓
 * VSCodeThemePackage
 *      ↓
 * VSCodeThemeEntry
 *      ↓
 * ThemeFileLoader
 *      ↓
 * EditorTheme
 *
 * Ou seja:
 * Essa classe contém apenas metadados sobre o tema,
 * não o conteúdo real das cores.
 */
public class VSCodeThemeEntry {

    /**
     * Identificador único do tema.
     *
     * Usado internamente pelo sistema para selecionar temas.
     *
     * Exemplo:
     * "np-dark"
     * "vscode-dark"
     */
    private String id;

    /**
     * Nome amigável do tema.
     *
     * Esse nome normalmente aparece na interface
     * quando o usuário escolhe um tema.
     *
     * Exemplo:
     * "NP Dark"
     * "VSCode Dark+"
     */
    private String label;

    /**
     * Tipo de tema da interface.
     *
     * Valores usados pelo VSCode:
     *
     * "vs"      → tema claro
     * "vs-dark" → tema escuro
     *
     * Isso é usado para decidir cores padrão
     * da interface e dos ícones.
     */
    private String uiTheme;

    /**
     * Caminho para o arquivo JSON que contém
     * as cores reais do tema.
     *
     * Exemplo:
     * "themes/vscode-dark.json"
     */
    private String path;

    /**
     * Metadados opcionais para agrupamento e previews visuais.
     *
     * Temas existentes continuam válidos mesmo sem esses campos.
     */
    private String category;
    private final List<String> categories = new ArrayList<>();
    private String image;
    private String preview;
    private final List<String> previews = new ArrayList<>();

    /**
     * Retorna o ID do tema.
     */
    public String getId() {
        return id;
    }

    /**
     * Retorna o nome amigável do tema.
     */
    public String getLabel() {
        return label;
    }

    /**
     * Retorna o tipo de UI do tema.
     */
    public String getUiTheme() {
        return uiTheme;
    }

    /**
     * Retorna o caminho do arquivo JSON do tema.
     */
    public String getPath() {
        return path;
    }

    public String getCategory() {
        return category;
    }

    public List<String> getCategories() {
        return categories == null ? List.of() : categories;
    }

    public String getImage() {
        return image;
    }
    private String welcomeLogo;

public String getWelcomeLogo() {
    return welcomeLogo;
}

public void setWelcomeLogo(String welcomeLogo) {
    this.welcomeLogo = welcomeLogo;
}

    public String getPreview() {
        return preview;
    }

    public List<String> getPreviews() {
        return previews == null ? List.of() : previews;
    }

    /**
     * Verifica se o tema é escuro.
     *
     * Um tema é considerado escuro se uiTheme == "vs-dark".
     */
    public boolean isDark() {
        return "vs-dark".equalsIgnoreCase(uiTheme);
    }

    /**
     * Verifica se o tema é claro.
     *
     * Um tema é considerado claro se uiTheme == "vs".
     */
    public boolean isLight() {
        return "vs".equalsIgnoreCase(uiTheme);
    }
}
