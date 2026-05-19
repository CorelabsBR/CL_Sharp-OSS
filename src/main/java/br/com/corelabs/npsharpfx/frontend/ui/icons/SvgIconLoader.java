package br.com.corelabs.npsharpfx.frontend.ui.icons;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.batik.transcoder.TranscoderInput;
import org.apache.batik.transcoder.TranscoderOutput;
import org.apache.batik.transcoder.image.PNGTranscoder;

import javafx.scene.image.Image;

public final class SvgIconLoader {

    private static final Pattern PATH_DATA_PATTERN = Pattern.compile("\\sd\\s*=\\s*([\"'])(.*?)\\1", Pattern.DOTALL);
    private static final Pattern STOP_WITHOUT_OFFSET_PATTERN = Pattern.compile(
            "<stop(?![^>]*\\soffset\\s*=)([^>]*)>",
            Pattern.CASE_INSENSITIVE
    );

    private SvgIconLoader() {
    }

    public static Image load(String resourcePath, int size) {
        try (InputStream stream = openResource(resourcePath)) {
            if (stream == null) {
                throw new RuntimeException("Icon not found: " + resourcePath);
            }

            String svg = sanitizeSvg(new String(stream.readAllBytes(), StandardCharsets.UTF_8));

            PNGTranscoder transcoder = new PNGTranscoder();
            transcoder.addTranscodingHint(PNGTranscoder.KEY_WIDTH, (float) size);
            transcoder.addTranscodingHint(PNGTranscoder.KEY_HEIGHT, (float) size);

            ByteArrayOutputStream png = new ByteArrayOutputStream();
            transcoder.transcode(
                    new TranscoderInput(new ByteArrayInputStream(svg.getBytes(StandardCharsets.UTF_8))),
                    new TranscoderOutput(png)
            );

            return new Image(
                    new ByteArrayInputStream(png.toByteArray()),
                    size,
                    size,
                    true,
                    true
            );
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to render SVG icon: " + resourcePath, e);
        }
    }

    public static String loadSvgPath(String resourcePath) {
        try (InputStream stream = openResource(resourcePath)) {
            if (stream == null) {
                System.err.println("SVG not found at: " + resourcePath);
                return "M0 0";
            }

            String svg = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
            Matcher matcher = PATH_DATA_PATTERN.matcher(svg);
            StringBuilder path = new StringBuilder();

            while (matcher.find()) {
                if (!path.isEmpty()) {
                    path.append(' ');
                }
                path.append(matcher.group(2).trim());
            }

            if (path.isEmpty()) {
                System.err.println("No path data found in: " + resourcePath);
                return "M0 0";
            }

            return path.toString();
        } catch (Exception e) {
            System.err.println("Failed to load SVG: " + resourcePath + " - " + e.getMessage());
            e.printStackTrace();
            return "M0 0";
        }
    }

    private static InputStream openResource(String resourcePath) {
        InputStream stream = SvgIconLoader.class.getResourceAsStream(resourcePath);

        if (stream != null) {
            return stream;
        }

        String pathWithoutSlash = resourcePath != null && resourcePath.startsWith("/")
                ? resourcePath.substring(1)
                : resourcePath;

        ClassLoader cl = Thread.currentThread().getContextClassLoader();
        if (cl != null && pathWithoutSlash != null) {
            stream = cl.getResourceAsStream(pathWithoutSlash);
        }

        if (stream == null && pathWithoutSlash != null) {
            stream = ClassLoader.getSystemResourceAsStream(pathWithoutSlash);
        }

        return stream;
    }

    private static String sanitizeSvg(String svg) {
        return STOP_WITHOUT_OFFSET_PATTERN.matcher(svg).replaceAll("<stop offset=\"0\"$1>");
    }
}
