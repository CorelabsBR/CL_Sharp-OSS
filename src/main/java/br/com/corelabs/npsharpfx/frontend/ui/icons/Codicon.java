package br.com.corelabs.npsharpfx.frontend.ui.icons;

// Importa a classe base Node do JavaFX.
// Tudo que aparece na tela no JavaFX herda de Node.
// Ou seja: botões, textos, imagens, SVG, tudo é Node.
import javafx.scene.Node;
import javafx.scene.shape.SVGPath;

/**
 * Classe utilitária responsável por criar ícones SVG no estilo "Codicon".
 * 
 * Codicons são os ícones usados no VS Code. Aqui a ideia é carregar
 * um caminho SVG (path) e transformá-lo em um Node JavaFX para
 * poder ser colocado em botões, menus, labels etc.
 * 
 * Esta classe não pode ser instanciada.
 */
public final class Codicon {

    /**
     * Construtor privado.
     * 
     * Isso impede que alguém faça:
     * new Codicon();
     * 
     * Como esta classe só possui métodos estáticos (utility class),
     * não faz sentido permitir instância.
     */
    private Codicon() {}

    /**
     * Cria um ícone SVG baseado em um arquivo de recurso.
     * 
     * Exemplo de uso:
     * Node icon = Codicon.icon("/icons/file.svg");
     * 
     * @param resourcePath Caminho do recurso SVG dentro do classpath
     * @return Node contendo o ícone SVG pronto para ser usado na interface
     */
    public static Node icon(String resourcePath) {

        try {
            /**
             * Carrega o path do SVG a partir do arquivo.
             * 
             * A classe SvgIconLoader provavelmente abre o SVG,
             * extrai o atributo "d" do <path>, e retorna como String.
             * 
             * Exemplo de conteúdo:
             * "M10 10 L20 20 Z"
             */
            String path = SvgIconLoader.loadSvgPath(resourcePath);

            /**
             * Cria um objeto SVGPath.
             * 
             * Esse objeto é o que realmente desenha o vetor no JavaFX.
             */
            SVGPath svg = new SVGPath();

            /**
             * Define o conteúdo do caminho SVG.
             * 
             * Aqui estamos dizendo ao JavaFX:
             * "Desenha esse vetor".
             */
            svg.setContent(path);

            /**
             * Adiciona uma classe CSS ao SVG.
             * 
             * Isso permite estilizar o ícone no arquivo CSS da aplicação,
             * por exemplo:
             * 
             * .codicon-svg {
             *     -fx-fill: #c5c5c5;
             *     -fx-scale-x: 1.2;
             *     -fx-scale-y: 1.2;
             * }
             */
            svg.getStyleClass().add("codicon-svg");

            /**
             * Retorna o SVG como Node.
             * 
             * Como SVGPath herda de Node, ele pode ser usado em qualquer
             * lugar da UI:
             * 
             * botão.setGraphic(Codicon.icon("/icons/file.svg"));
             * label.setGraphic(Codicon.icon("/icons/folder.svg"));
             */
            return svg;
        } catch (Exception e) {
            System.err.println("Error loading icon: " + resourcePath + " - " + e.getMessage());
            // Retorna um SVG vazio em caso de erro ao invés de quebrar a UI
            SVGPath emptyIcon = new SVGPath();
            emptyIcon.setContent("M0 0");
            emptyIcon.getStyleClass().add("codicon-svg");
            return emptyIcon;
        }
    }
}

