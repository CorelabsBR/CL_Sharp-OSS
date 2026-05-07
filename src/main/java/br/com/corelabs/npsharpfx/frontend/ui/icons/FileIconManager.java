package br.com.corelabs.npsharpfx.frontend.ui.icons;

// Classe File do Java padrão.
// Representa arquivos e diretórios do sistema de arquivos.
import java.io.File;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

import javafx.scene.Node;
import javafx.scene.image.ImageView;

/**
 * Classe responsável por resolver e carregar ícones de arquivos
 * baseado na extensão ou nome especial.
 *
 * Essa classe imita o comportamento do VS Code:
 *
 * arquivo.java  → ícone java
 * arquivo.json  → ícone json
 * pasta         → ícone de pasta
 * pasta aberta  → ícone pasta aberta
 *
 * Ela centraliza toda a lógica de escolha de ícone.
 *
 * Arquitetura:
 *
 * File
 *   ↓
 * resolveIcon()
 *   ↓
 * nome do ícone SVG
 *   ↓
 * SvgIconLoader
 *   ↓
 * ImageView
 *   ↓
 * Node usado na UI
 *
 * Classe utilitária (não instanciável).
 */
public final class FileIconManager {

    /**
     * Mapa que relaciona extensões de arquivo com ícones SVG.
     *
     * Exemplo:
     *
     * "java" → "java.svg"
     * "json" → "json.svg"
     */
    private static final Map<String, String> EXTENSION_ICONS = new HashMap<>();

    /**
     * Bloco estático executado quando a classe é carregada.
     *
     * Aqui são registrados os ícones por extensão.
     *
     * Isso evita if gigante depois.
     */
    static {

        // Linguagens
        EXTENSION_ICONS.put("java", "java.svg");
        EXTENSION_ICONS.put("js", "js.svg");
        EXTENSION_ICONS.put("ts", "typescript.svg");

        // Dados
        EXTENSION_ICONS.put("json", "json.svg");
        EXTENSION_ICONS.put("xml", "xml.svg");
        EXTENSION_ICONS.put("csv", "csv.svg");

        // Web
        EXTENSION_ICONS.put("html", "html.svg");
        EXTENSION_ICONS.put("css", "css.svg");
        EXTENSION_ICONS.put("scss", "scss.svg");

        // Documentação
        EXTENSION_ICONS.put("md", "markdown.svg");
        EXTENSION_ICONS.put("txt", "txt.svg");

        // Configuração
        EXTENSION_ICONS.put("yml", "yaml.svg");
        EXTENSION_ICONS.put("yaml", "yaml.svg");
        EXTENSION_ICONS.put("properties", "properties.svg");

        // Banco
        EXTENSION_ICONS.put("sql", "sql.svg");

        // Binários / arquivos compactados
        EXTENSION_ICONS.put("jar", "jar.svg");
        EXTENSION_ICONS.put("zip", "zip.svg");

        // Documentos
        EXTENSION_ICONS.put("pdf", "pdf.svg");

        // Imagens
        EXTENSION_ICONS.put("png", "imagepng.svg");
        EXTENSION_ICONS.put("jpg", "imagejpg.svg");
        EXTENSION_ICONS.put("jpeg", "imagejpg.svg");
        EXTENSION_ICONS.put("gif", "imagegif.svg");
        EXTENSION_ICONS.put("svg", "svg.svg");

        // Build / scripts
        EXTENSION_ICONS.put("gradle", "gradle.svg");
        EXTENSION_ICONS.put("bat", "bat.svg");
        EXTENSION_ICONS.put("sh", "shell.svg");
    }

    /**
     * Construtor privado.
     *
     * Isso impede criação de instâncias:
     *
     * new FileIconManager();
     *
     * Porque a classe é utilitária (somente métodos estáticos).
     */
    private FileIconManager() {
    }

    /**
     * Retorna o ícone visual correspondente a um arquivo.
     *
     * @param file arquivo ou diretório
     * @param expanded indica se pasta está aberta (para trocar ícone)
     *
     * @return Node contendo o ícone do arquivo
     */
    public static Node getIcon(File file, boolean expanded) {

        /**
         * Descobre qual ícone deve ser usado.
         */
        String iconName = resolveIcon(file, expanded);

        /**
         * Carrega o SVG convertido em imagem.
         *
         * Caminho base:
         *
         * /fileicons/icons/
         */
        javafx.scene.image.Image img = null;
        
        try {
            img = SvgIconLoader.load("/fileicons/icons/" + iconName, 16);
        } catch (RuntimeException e) {
            // Se o ícone específico não existir, tenta fallback
            System.err.println("ICON NOT FOUND: " + iconName + " (" + e.getMessage() + ")");
            
            try {
                img = SvgIconLoader.load("/fileicons/icons/file.svg", 16);
            } catch (RuntimeException fallbackError) {
                // Se nem o fallback existir, cria um ícone vazio placeholder
                System.err.println("FALLBACK ICON ALSO FAILED: " + fallbackError.getMessage());
                
                // Retorna um ImageView vazio para evitar NPE
                ImageView emptyView = new ImageView();
                emptyView.setFitWidth(16);
                emptyView.setFitHeight(16);
                return emptyView;
            }
        }

        /**
         * Cria um componente visual para exibir a imagem.
         */
        ImageView view = new ImageView(img);

        /**
         * Define tamanho do ícone.
         */
        view.setFitWidth(16);
        view.setFitHeight(16);

        /**
         * Mantém proporção original da imagem.
         */
        view.setPreserveRatio(true);

        /**
         * Aplica suavização (anti-aliasing).
         */
        view.setSmooth(true);

        /**
         * Retorna o ícone pronto para UI.
         */
        return view;
    }

    /**
     * Resolve qual nome de ícone deve ser usado
     * baseado no tipo de arquivo.
     *
     * @param file arquivo ou pasta
     * @param expanded indica se pasta está aberta
     *
     * @return nome do arquivo SVG do ícone
     */
    private static String resolveIcon(File file, boolean expanded) {

        if (file == null || file.getName() == null) {
            return "file.svg";
        }

        /**
         * Se for diretório, retorna ícone de pasta.
         */
        if (file.isDirectory()) {

            // pasta aberta vs fechada
            return expanded ? "folder_open.svg" : "folder.svg";
        }

        /**
         * Nome do arquivo em lowercase para facilitar comparação.
         */
        String lowerName = Objects.requireNonNull(file.getName()).toLowerCase(Locale.ROOT);
        assert lowerName != null;

        /**
         * Casos especiais baseados no nome do arquivo.
         *
         * Muitos editores fazem isso.
         */
        String specialIcon = switch (lowerName) {
            case "readme.md" -> "readme.svg";
            case "package.json" -> "node.svg";
            case "pom.xml" -> "maven.svg";
            case ".gitignore" -> "git.svg";
            case "dockerfile" -> "docker.svg";
            case "makefile" -> "makefile.svg";
            default -> null;
        };

        if (specialIcon != null) {
            return specialIcon;
        }

        /**
         * Procura o último ponto no nome do arquivo
         * para descobrir extensão.
         */
        int dotIndex = lowerName.lastIndexOf('.');

        /**
         * Caso não tenha extensão:
         *
         * arquivo
         * README
         */
        if (dotIndex == -1 || dotIndex == lowerName.length() - 1) {

            // ícone genérico
            return "file.svg";
        }

        /**
         * Extrai extensão do arquivo.
         */
        String extension = lowerName.substring(dotIndex + 1);

        /**
         * Busca ícone correspondente no mapa.
         *
         * Se não existir → usa ícone padrão.
         */
        return EXTENSION_ICONS.getOrDefault(extension, "file.svg");
    }
}

