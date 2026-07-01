/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
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
            String path = SvgIconLoader.loadSvgPath(resourcePath);

            SVGPath svg = new SVGPath();
            svg.setContent(path);
            svg.getStyleClass().add("codicon-svg");

            return svg;
        } catch (Exception e) {
            System.err.println("[CODICON ERROR] Failed to load icon: " + resourcePath);
            e.printStackTrace();
            
            // Retorna um SVG com placeholder em caso de erro
            SVGPath emptyIcon = new SVGPath();
            emptyIcon.setContent("M8 2C4.13 2 1 5.13 1 9s3.13 7 7 7 7-3.13 7-7-3.13-7-7-7z M9 14H7v-2h2v2z M9 11H7V5h2v6z");
            emptyIcon.getStyleClass().add("codicon-svg");
            emptyIcon.setScaleX(0.75);
            emptyIcon.setScaleY(0.75);
            return emptyIcon;
        }
    }
}

