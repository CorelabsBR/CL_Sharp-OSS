/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */


package br.com.corelabs.npsharpfx.frontend.ui.theme;

// Classe base de containers da UI no JavaFX.
// Parent representa qualquer nó que pode ter filhos (VBox, BorderPane, Scene root etc).
import javafx.scene.Parent;

/**
 * Classe utilitária responsável por aplicar o modo de tema
 * na interface gráfica do editor.
 *
 * O funcionamento é simples:
 *
 * 1) Remove classes de tema existentes
 * 2) Normaliza o valor do tema
 * 3) Aplica classe CSS correspondente
 *
 * Isso permite trocar tema dinamicamente usando CSS.
 *
 * Exemplo de CSS:
 *
 * .theme-np {
 *     -fx-background-color: #ffffff;
 * }
 *
 * .theme-np-dark {
 *     -fx-background-color: #1e1e1e;
 * }
 *
 * Classe utilitária (somente métodos estáticos).
 */
public final class ThemeHelper {

    /**
     * Construtor privado.
     *
     * Impede criação de instâncias da classe.
     */
    private ThemeHelper() {
    }

    /**
     * Aplica o tema na árvore de UI.
     *
     * O método funciona adicionando uma classe CSS
     * no root da interface.
     *
     * @param root nó raiz da interface
     * @param themeValue valor bruto do tema
     */
    public static void applyThemeMode(Parent root, String themeValue) {

        /**
         * Remove classes de tema anteriores
         * para evitar conflito de estilos.
         */
        root.getStyleClass().removeAll("theme-np", "theme-np-dark");

        /**
         * Normaliza valor do tema recebido.
         */
        String normalized = normalizeTheme(themeValue);

        /**
         * Aplica classe CSS correspondente.
         */
        switch (normalized) {
            case "np" -> root.getStyleClass().add("theme-np");
            case "np-dark" -> root.getStyleClass().add("theme-np-dark");
            default -> root.getStyleClass().add("theme-np-dark");
        }
    }

    /**
     * Normaliza o valor do tema recebido.
     *
     * Esse método permite aceitar múltiplos formatos:
     *
     * "np"
     * "np-dark"
     * "theme:np-dark"
     * "theme=np-dark"
     *
     * @param raw valor original recebido
     * @return valor normalizado do tema
     */
    public static String normalizeTheme(String raw) {

        /**
         * Caso valor seja nulo,
         * usa tema escuro padrão.
         */
        if (raw == null) {
            return "np-dark";
        }

        /**
         * Remove espaços extras
         * e converte para minúsculas.
         */
        String value = raw.trim().toLowerCase();

        /**
         * Remove prefixo "theme:"
         *
         * Exemplo:
         * theme:np-dark → np-dark
         */
        if (value.startsWith("theme:")) {

            value = value.substring("theme:".length()).trim();

        } else if (value.startsWith("theme=")) {

            /**
             * Remove prefixo "theme="
             *
             * Exemplo:
             * theme=np-dark → np-dark
             */
            value = value.substring("theme=".length()).trim();
        }

        /**
         * Verifica tema claro.
         */
        if ("np".equals(value)) {
            return "np";
        }

        /**
         * Verifica tema escuro.
         */
        if ("np-dark".equals(value)) {
            return "np-dark";
        }

        /**
         * Caso valor não seja reconhecido,
         * retorna fallback padrão.
         */
        return "np-dark";
    }
}

