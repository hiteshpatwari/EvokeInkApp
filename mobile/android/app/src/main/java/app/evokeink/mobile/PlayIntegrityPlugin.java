package app.evokeink.mobile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.tasks.Task;
import com.google.android.play.core.integrity.IntegrityManagerFactory;
import com.google.android.play.core.integrity.StandardIntegrityManager;

@CapacitorPlugin(name = "PlayIntegrity")
public final class PlayIntegrityPlugin extends Plugin {
    private StandardIntegrityManager manager;
    private Task<StandardIntegrityManager.StandardIntegrityTokenProvider> providerTask;

    @Override
    public void load() {
        manager = IntegrityManagerFactory.createStandard(getContext());
    }

    private synchronized Task<StandardIntegrityManager.StandardIntegrityTokenProvider> prepareProvider() {
        if (BuildConfig.PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER <= 0) {
            throw new IllegalStateException("Play Integrity is not configured");
        }
        if (providerTask == null || providerTask.isCanceled() || providerTask.isComplete() && !providerTask.isSuccessful()) {
            providerTask = manager.prepareIntegrityToken(
                StandardIntegrityManager.PrepareIntegrityTokenRequest.builder()
                    .setCloudProjectNumber(BuildConfig.PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER)
                    .build()
            );
        }
        return providerTask;
    }

    private synchronized void invalidateProvider(
        Task<StandardIntegrityManager.StandardIntegrityTokenProvider> expected
    ) {
        if (providerTask == expected) {
            providerTask = null;
        }
    }

    @PluginMethod
    public void prepare(PluginCall call) {
        final Task<StandardIntegrityManager.StandardIntegrityTokenProvider> task;
        try {
            task = prepareProvider();
        } catch (RuntimeException error) {
            call.reject("Play Integrity is unavailable");
            return;
        }
        task.addOnSuccessListener(provider -> call.resolve())
            .addOnFailureListener(error -> call.reject("Play Integrity is unavailable"));
    }

    @PluginMethod
    public void requestToken(PluginCall call) {
        String requestHash = call.getString("requestHash");
        if (requestHash == null || !requestHash.matches("^[A-Za-z0-9_-]{43}$")) {
            call.reject("A valid request hash is required");
            return;
        }

        final Task<StandardIntegrityManager.StandardIntegrityTokenProvider> task;
        try {
            task = prepareProvider();
        } catch (RuntimeException error) {
            call.reject("Play Integrity is unavailable");
            return;
        }
        task.addOnSuccessListener(provider -> provider.request(
                StandardIntegrityManager.StandardIntegrityTokenRequest.builder()
                    .setRequestHash(requestHash)
                    .build()
            )
            .addOnSuccessListener(response -> {
                JSObject result = new JSObject();
                result.put("token", response.token());
                call.resolve(result);
            })
            .addOnFailureListener(error -> {
                invalidateProvider(task);
                call.reject("Play Integrity is unavailable");
            })
        ).addOnFailureListener(error -> {
            invalidateProvider(task);
            call.reject("Play Integrity is unavailable");
        });
    }
}
