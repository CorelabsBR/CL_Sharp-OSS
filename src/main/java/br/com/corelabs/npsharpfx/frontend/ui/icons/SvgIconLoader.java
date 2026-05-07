package br.com.corelabs.npsharpfx.frontend.ui.icons;

// Classe usada para trabalhar com streams de arquivos.
// Aqui é usada para ler recursos internos do classpath (ícones SVG).
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import javafx.scene.image.Image;

/**
 * Classe utilitária responsável por carregar ícones SVG do classpath.
 *
 * Ela possui dois modos de operação:
 *
 * 1) Converter SVG em Image (para ícones de arquivos)
 * 2) Extrair o atributo "d" do SVG (para SVGPath do JavaFX)
 *
 * Ou seja:
 *
 * SVG
 *  ↓
 * ou vira Image
 * ou vira path String
 *
 * Isso permite usar ícones de duas formas diferentes dentro da UI.
 */
public final class SvgIconLoader {

    /**
     * Construtor privado.
     *
     * Impede instanciamento da classe.
     *
     * Essa classe funciona como utilitário estático.
     */
    private SvgIconLoader() {}

    /**
     * Carrega um SVG como Image JavaFX.
     *
     * Usado principalmente pelos ícones de arquivos
     * exibidos no explorer.
     *
     * @param resourcePath caminho do recurso dentro do classpath
     * @param size tamanho desejado da imagem
     *
     * @return Image pronta para ser exibida em ImageView
     */
    public static Image load(String resourcePath, int size) {

        /**
         * Abre um stream do recurso dentro do classpath.
         *
         * Exemplo de caminho:
         * /fileicons/icons/java.svg
         */
        InputStream stream = SvgIconLoader.class.getResourceAsStream(resourcePath);

        /**
         * Caso o recurso não exista, lança erro.
         */
        if (stream == null) {
            throw new RuntimeException("Icon not found: " + resourcePath);
        }

        /**
         * Cria a imagem JavaFX.
         *
         * Parâmetros:
         *
         * stream  → fonte da imagem
         * size    → largura
         * size    → altura
         * true    → preservar proporção
         * true    → aplicar suavização
         */
        return new Image(stream, size, size, true, true);
    }

    /**
     * Carrega um SVG e extrai o atributo "d" do path.
     *
     * Esse método é usado pelos Codicons que utilizam
     * SVGPath em vez de ImageView.
     *
     * O atributo "d" contém o caminho vetorial do SVG.
     *
     * Exemplo de SVG:
     *
     * <svg>
     *   <path d="M10 10 L20 20 Z"/>
     * </svg>
     *
     * O método extrai apenas:
     *
     * M10 10 L20 20 Z
     *
     * @param resourcePath caminho do arquivo SVG
     *
     * @return String contendo o path vetorial
     */
    public static String loadSvgPath(String resourcePath) {

        /**
         * try-with-resources garante que o stream
         * será fechado automaticamente.
         */
        try (InputStream stream = SvgIconLoader.class.getResourceAsStream(resourcePath)) {

            /**
             * Verifica se o arquivo existe.
             */
            if (stream == null) {
                throw new RuntimeException("Icon not found: " + resourcePath);
            }

            /**
             * Lê todos os bytes do arquivo SVG
             * e converte para String UTF-8.
             */
            String svg = new String(stream.readAllBytes(), StandardCharsets.UTF_8);

            // Tenta encontrar o atributo d com diferentes formatos possíveis
            int startIndex = svg.indexOf("d=\"");
            if (startIndex == -1) {
                startIndex = svg.indexOf("d='");
                if (startIndex == -1) {
                    // Se não encontrar, retorna um path vazio válido
                    return "M0 0";
                }
                startIndex += 3; // d='
                int endIndex = svg.indexOf("'", startIndex);
                if (endIndex != -1) {
                    return svg.substring(startIndex, endIndex);
                }
                return "M0 0";
            }

            startIndex += 3; // d="
            int endIndex = svg.indexOf("\"", startIndex);
            
            if (endIndex == -1) {
                return "M0 0";
            }

            /**
             * Extrai apenas o conteúdo do path.
             */
            return svg.substring(startIndex, endIndex);

        } catch (Exception e) {

            /**
             * Caso qualquer erro ocorra,
             * encapsula em RuntimeException.
             */
            System.err.println("Failed to load SVG: " + resourcePath + " - " + e.getMessage());
            throw new RuntimeException("Failed to load svg: " + resourcePath, e);
        }
    }
}

