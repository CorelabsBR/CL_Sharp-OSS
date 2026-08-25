package br.com.corelabs.sharp;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Storage Access Framework bridge. Files always remain in the folder picked by the user. */
@CapacitorPlugin(name = "SharpWorkspace")
public class SharpWorkspacePlugin extends Plugin {
    private static final String[] DOCUMENT_COLUMNS = {
        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
        DocumentsContract.Document.COLUMN_MIME_TYPE,
        DocumentsContract.Document.COLUMN_SIZE,
        DocumentsContract.Document.COLUMN_LAST_MODIFIED
    };

    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "pickedWorkspace");
    }

    @ActivityCallback
    private void pickedWorkspace(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject canceled = new JSObject();
            canceled.put("canceled", true);
            call.resolve(canceled);
            return;
        }
        Uri treeUri = result.getData().getData();
        int flags = result.getData().getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        getContext().getContentResolver().takePersistableUriPermission(treeUri, flags);
        Uri root = rootUri(treeUri);
        JSObject selected = new JSObject();
        selected.put("canceled", false);
        selected.put("uri", treeUri.toString());
        selected.put("name", displayName(root));
        selected.put("location", treeUri.toString());
        call.resolve(selected);
    }

    @PluginMethod
    public void list(PluginCall call) {
        try {
            Uri tree = treeUri(call);
            Uri directory = resolve(tree, call.getString("relative", ""));
            JSArray entries = new JSArray();
            for (DocumentInfo entry : children(tree, directory)) {
                JSObject item = new JSObject();
                item.put("name", entry.name);
                item.put("directory", entry.directory);
                item.put("size", entry.size);
                item.put("modifiedAt", entry.modifiedAt);
                item.put("hidden", entry.name.startsWith("."));
                entries.put(item);
            }
            JSObject output = new JSObject();
            output.put("entries", entries);
            call.resolve(output);
        } catch (Exception error) {
            call.reject("Não foi possível listar a pasta escolhida.", error);
        }
    }

    @PluginMethod
    public void read(PluginCall call) {
        try {
            Uri document = resolve(treeUri(call), call.getString("relative", ""));
            try (InputStream input = getContext().getContentResolver().openInputStream(document)) {
                if (input == null) throw new IllegalStateException("Não foi possível abrir o arquivo.");
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                JSObject result = new JSObject();
                result.put("content", output.toString(StandardCharsets.UTF_8.name()));
                call.resolve(result);
            }
        } catch (Exception error) {
            call.reject("Não foi possível ler o arquivo na pasta escolhida.", error);
        }
    }

    @PluginMethod
    public void write(PluginCall call) {
        try {
            Uri tree = treeUri(call);
            List<String> parts = segments(call.getString("relative", ""));
            if (parts.isEmpty()) throw new IllegalArgumentException("Nome de arquivo ausente.");
            Uri parent = resolveOrCreateDirectories(tree, parts.subList(0, parts.size() - 1));
            Uri document = childByName(tree, parent, parts.get(parts.size() - 1));
            if (document == null) document = DocumentsContract.createDocument(getContext().getContentResolver(), parent, "text/plain", parts.get(parts.size() - 1));
            if (document == null) throw new IllegalStateException("Não foi possível criar o arquivo.");
            try (OutputStream output = getContext().getContentResolver().openOutputStream(document, "wt")) {
                if (output == null) throw new IllegalStateException("Não foi possível gravar o arquivo.");
                output.write(call.getString("content", "").getBytes(StandardCharsets.UTF_8));
            }
            call.resolve();
        } catch (Exception error) {
            call.reject("Não foi possível gravar na pasta escolhida.", error);
        }
    }

    @PluginMethod
    public void mkdir(PluginCall call) {
        try {
            resolveOrCreateDirectories(treeUri(call), segments(call.getString("relative", "")));
            call.resolve();
        } catch (Exception error) {
            call.reject("Não foi possível criar a pasta.", error);
        }
    }

    @PluginMethod
    public void rename(PluginCall call) {
        try {
            Uri tree = treeUri(call);
            List<String> from = segments(call.getString("relative", ""));
            List<String> to = segments(call.getString("newRelative", ""));
            if (from.isEmpty() || to.isEmpty() || !from.subList(0, from.size() - 1).equals(to.subList(0, to.size() - 1))) {
                throw new IllegalArgumentException("Mover itens entre pastas não é suportado pelo provedor selecionado.");
            }
            Uri renamed = DocumentsContract.renameDocument(getContext().getContentResolver(), resolve(tree, join(from)) , to.get(to.size() - 1));
            if (renamed == null) throw new IllegalStateException("O provedor recusou a renomeação.");
            call.resolve();
        } catch (Exception error) {
            call.reject("Não foi possível renomear o item.", error);
        }
    }

    @PluginMethod
    public void delete(PluginCall call) {
        try {
            Uri tree = treeUri(call);
            deleteRecursively(tree, resolve(tree, call.getString("relative", "")));
            call.resolve();
        } catch (Exception error) {
            call.reject("Não foi possível excluir o item.", error);
        }
    }

    @PluginMethod
    public void exists(PluginCall call) {
        try {
            resolve(treeUri(call), call.getString("relative", ""));
            JSObject result = new JSObject();
            result.put("exists", true);
            call.resolve(result);
        } catch (Exception ignored) {
            JSObject result = new JSObject();
            result.put("exists", false);
            call.resolve(result);
        }
    }

    private Uri treeUri(PluginCall call) {
        String value = call.getString("uri");
        if (value == null || value.isEmpty()) throw new IllegalArgumentException("Pasta escolhida ausente.");
        return Uri.parse(value);
    }

    private Uri rootUri(Uri tree) {
        return DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
    }

    private Uri resolve(Uri tree, String relative) throws Exception {
        Uri current = rootUri(tree);
        for (String segment : segments(relative)) {
            Uri child = childByName(tree, current, segment);
            if (child == null) throw new IllegalArgumentException("Item não encontrado: " + segment);
            current = child;
        }
        return current;
    }

    private Uri resolveOrCreateDirectories(Uri tree, List<String> parts) throws Exception {
        Uri current = rootUri(tree);
        for (String segment : parts) {
            Uri child = childByName(tree, current, segment);
            if (child == null) child = DocumentsContract.createDocument(getContext().getContentResolver(), current, DocumentsContract.Document.MIME_TYPE_DIR, segment);
            if (child == null) throw new IllegalStateException("Não foi possível criar a pasta " + segment);
            current = child;
        }
        return current;
    }

    private Uri childByName(Uri tree, Uri parent, String name) throws Exception {
        for (DocumentInfo child : children(tree, parent)) if (child.name.equals(name)) return child.uri;
        return null;
    }

    private List<DocumentInfo> children(Uri tree, Uri parent) throws Exception {
        String documentId = DocumentsContract.getDocumentId(parent);
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(tree, documentId);
        List<DocumentInfo> result = new ArrayList<>();
        try (Cursor cursor = getContext().getContentResolver().query(childrenUri, DOCUMENT_COLUMNS, null, null, null)) {
            if (cursor == null) return result;
            while (cursor.moveToNext()) {
                String id = cursor.getString(0);
                String name = cursor.getString(1);
                String mime = cursor.getString(2);
                long size = cursor.isNull(3) ? 0 : cursor.getLong(3);
                long modified = cursor.isNull(4) ? 0 : cursor.getLong(4);
                result.add(new DocumentInfo(DocumentsContract.buildDocumentUriUsingTree(tree, id), name, DocumentsContract.Document.MIME_TYPE_DIR.equals(mime), size, modified));
            }
        }
        return result;
    }

    private void deleteRecursively(Uri tree, Uri document) throws Exception {
        for (DocumentInfo child : children(tree, document)) deleteRecursively(tree, child.uri);
        if (!DocumentsContract.deleteDocument(getContext().getContentResolver(), document)) throw new IllegalStateException("O provedor recusou a exclusão.");
    }

    private String displayName(Uri document) {
        try (Cursor cursor = getContext().getContentResolver().query(document, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            return cursor != null && cursor.moveToFirst() ? cursor.getString(0) : "Pasta selecionada";
        }
    }

    private List<String> segments(String relative) {
        if (relative == null || relative.isEmpty()) return new ArrayList<>();
        List<String> result = new ArrayList<>();
        for (String segment : Arrays.asList(relative.split("/"))) {
            if (segment.isEmpty()) continue;
            if (segment.equals(".") || segment.equals("..") || segment.contains("\\")) throw new IllegalArgumentException("Caminho inválido.");
            result.add(segment);
        }
        return result;
    }

    private String join(List<String> parts) { return String.join("/", parts); }

    private static final class DocumentInfo {
        final Uri uri;
        final String name;
        final boolean directory;
        final long size;
        final long modifiedAt;
        DocumentInfo(Uri uri, String name, boolean directory, long size, long modifiedAt) {
            this.uri = uri;
            this.name = name;
            this.directory = directory;
            this.size = size;
            this.modifiedAt = modifiedAt;
        }
    }
}
