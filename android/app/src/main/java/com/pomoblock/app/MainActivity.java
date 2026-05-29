package com.pomoblock.app;

import android.os.Bundle;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;

import com.getcapacitor.BridgeActivity;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

public class MainActivity extends BridgeActivity {

    private AppUpdateManager appUpdateManager;
    private ActivityResultLauncher<IntentSenderRequest> updateResultLauncher;
    private InstallStateUpdatedListener installStateListener;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        appUpdateManager = AppUpdateManagerFactory.create(this);

        updateResultLauncher = registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(),
            result -> { /* user declined or update failed — retries on next resume */ }
        );

        installStateListener = state -> {
            if (state.installStatus() == InstallStatus.DOWNLOADED) {
                promptFlexibleInstall();
            }
        };
        appUpdateManager.registerListener(installStateListener);
    }

    @Override
    public void onResume() {
        super.onResume();
        checkForUpdate();
    }

    @Override
    public void onDestroy() {
        if (appUpdateManager != null && installStateListener != null) {
            appUpdateManager.unregisterListener(installStateListener);
        }
        super.onDestroy();
    }

    private void checkForUpdate() {
        if (appUpdateManager == null) return;
        appUpdateManager.getAppUpdateInfo().addOnSuccessListener(info -> {
            int priority = info.updatePriority();
            int updateType = priority >= 4 ? AppUpdateType.IMMEDIATE : AppUpdateType.FLEXIBLE;

            if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                    && info.isUpdateTypeAllowed(updateType)) {
                appUpdateManager.startUpdateFlowForResult(
                    info, updateResultLauncher,
                    AppUpdateOptions.newBuilder(updateType).build());
            } else if (info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
                    && priority >= 4) {
                // Resume a stalled immediate update only if still high priority
                appUpdateManager.startUpdateFlowForResult(
                    info, updateResultLauncher,
                    AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build());
            } else if (info.installStatus() == InstallStatus.DOWNLOADED) {
                // Flexible update finished downloading while app was backgrounded
                promptFlexibleInstall();
            }
        });
    }

    private void promptFlexibleInstall() {
        new android.app.AlertDialog.Builder(this)
            .setTitle("Update Ready")
            .setMessage("The update has been downloaded. Restart now to apply it?")
            .setCancelable(false)
            .setNegativeButton("Later", null)
            .setPositiveButton("Restart", (d, w) -> appUpdateManager.completeUpdate())
            .show();
    }
}
