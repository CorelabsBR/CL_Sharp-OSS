/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.ui.window.layout;

import java.util.Map;
import java.util.WeakHashMap;

import javafx.animation.FadeTransition;
import javafx.animation.Interpolator;
import javafx.animation.KeyFrame;
import javafx.animation.KeyValue;
import javafx.animation.ParallelTransition;
import javafx.animation.Timeline;
import javafx.animation.TranslateTransition;
import javafx.scene.Node;
import javafx.scene.control.SplitPane;
import javafx.util.Duration;

/**
 * Centraliza microinteracoes do shell JavaFX.
 *
 * O VSCode real usa compositor nativo/Electron para animar paineis sem travar
 * listas grandes. Em JavaFX, a forma mais estavel e animar somente opacidade,
 * translacao e posicao de divisor, evitando relayout pesado em cada frame.
 */
public final class VSCodeLayoutAnimator {

    private static final Duration PANEL_DURATION = Duration.millis(120);
    private static final Duration DIVIDER_DURATION = Duration.millis(140);
    private static final Map<SplitPane, Timeline> SPLIT_ANIMATIONS = new WeakHashMap<>();

    private VSCodeLayoutAnimator() {
    }

    public static void fadeSlideIn(Node node, double fromX, double fromY) {
        if (node == null) {
            return;
        }

        node.setOpacity(0.0);
        node.setTranslateX(fromX);
        node.setTranslateY(fromY);

        FadeTransition fade = new FadeTransition(PANEL_DURATION, node);
        fade.setFromValue(0.0);
        fade.setToValue(1.0);

        TranslateTransition slide = new TranslateTransition(PANEL_DURATION, node);
        slide.setFromX(fromX);
        slide.setFromY(fromY);
        slide.setToX(0.0);
        slide.setToY(0.0);
        slide.setInterpolator(Interpolator.EASE_OUT);

        new ParallelTransition(fade, slide).play();
    }

    public static void fadeSlideOut(Node node, double toX, double toY, Runnable after) {
        if (node == null) {
            if (after != null) {
                after.run();
            }
            return;
        }

        FadeTransition fade = new FadeTransition(PANEL_DURATION, node);
        fade.setToValue(0.0);

        TranslateTransition slide = new TranslateTransition(PANEL_DURATION, node);
        slide.setToX(toX);
        slide.setToY(toY);
        slide.setInterpolator(Interpolator.EASE_IN);

        ParallelTransition transition = new ParallelTransition(fade, slide);
        transition.setOnFinished(event -> {
            node.setTranslateX(0.0);
            node.setTranslateY(0.0);
            node.setOpacity(1.0);
            if (after != null) {
                after.run();
            }
        });
        transition.play();
    }

    public static void animateDivider(SplitPane splitPane, int dividerIndex, double targetPosition) {
        if (splitPane == null || dividerIndex < 0 || splitPane.getDividers().size() <= dividerIndex) {
            return;
        }

        double clamped = Math.max(0.0, Math.min(1.0, targetPosition));
        Timeline running = SPLIT_ANIMATIONS.remove(splitPane);
        if (running != null) {
            running.stop();
        }

        Timeline timeline = new Timeline(
                new KeyFrame(
                        DIVIDER_DURATION,
                        new KeyValue(
                                splitPane.getDividers().get(dividerIndex).positionProperty(),
                                clamped,
                                Interpolator.EASE_BOTH
                        )
                )
        );
        timeline.setOnFinished(event -> SPLIT_ANIMATIONS.remove(splitPane));
        SPLIT_ANIMATIONS.put(splitPane, timeline);
        timeline.play();
    }
}
