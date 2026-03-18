import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { saveToCloud, loadFromCloud, getBackupId, setBackupId, type CloudData } from "@/utils/cloud-storage";

interface CloudBackupProps {
  onRestore: (data: CloudData) => void;
  getCurrentData: () => CloudData;
}

export const CloudBackup = ({ onRestore, getCurrentData }: CloudBackupProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [restoreId, setRestoreId] = useState("");
  const [showRestore, setShowRestore] = useState(false);

  const handleBackup = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const data = getCurrentData();
      const result = await saveToCloud(data);

      if (result.success) {
        setMessage({
          type: 'success',
          text: `Backup saved! ID: ${result.binId}`
        });
      } else {
        setMessage({
          type: 'error',
          text: `Backup failed: ${result.error}`
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Backup failed: Network error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (binId?: string) => {
    setIsLoading(true);
    setMessage(null);

    try {
      const result = await loadFromCloud(binId);

      if (result.success && result.data) {
        onRestore(result.data);
        if (binId) {
          setBackupId(binId);
        }
        setMessage({
          type: 'success',
          text: 'Data restored successfully!'
        });
        setShowRestore(false);
        setRestoreId("");
      } else {
        setMessage({
          type: 'error',
          text: `Restore failed: ${result.error}`
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Restore failed: Network error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const currentBackupId = getBackupId();

  return (
    <div className="space-y-4 p-4 border border-border rounded-lg bg-surface">
      <div className="flex items-center justify-between">
        <h3 className="font-mono-ui text-sm text-foreground">CLOUD BACKUP</h3>
        <div className="flex gap-2">
          <Button
            onClick={handleBackup}
            disabled={isLoading}
            size="sm"
            variant="outline"
            className="font-mono-ui text-xs"
          >
            {isLoading ? "..." : "☁️ BACKUP"}
          </Button>
          <Button
            onClick={() => setShowRestore(!showRestore)}
            size="sm"
            variant="outline"
            className="font-mono-ui text-xs"
          >
            📥 RESTORE
          </Button>
        </div>
      </div>

      {currentBackupId && (
        <div className="text-xs text-muted-foreground">
          <strong>Your Backup ID:</strong> {currentBackupId}
          <br />
          <span className="text-green-400">Save this ID to restore your data on any device!</span>
        </div>
      )}

      {showRestore && (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="flex gap-2">
            <Input
              placeholder="Enter backup ID to restore..."
              value={restoreId}
              onChange={(e) => setRestoreId(e.target.value)}
              className="font-mono-ui text-xs"
            />
            <Button
              onClick={() => handleRestore(restoreId)}
              disabled={isLoading || !restoreId.trim()}
              size="sm"
              className="font-mono-ui text-xs"
            >
              RESTORE
            </Button>
          </div>
          
          {currentBackupId && (
            <Button
              onClick={() => handleRestore()}
              disabled={isLoading}
              size="sm"
              variant="outline"
              className="w-full font-mono-ui text-xs"
            >
              RESTORE FROM MY BACKUP
            </Button>
          )}
        </div>
      )}

      {message && (
        <Alert className={message.type === 'error' ? 'border-red-500' : 'border-green-500'}>
          <AlertDescription className="font-mono-ui text-xs">
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      <div className="text-xs text-muted-foreground">
        <strong>How it works:</strong>
        <br />• Backup saves all your annotations, notes, and settings to the cloud
        <br />• Get a unique ID to restore your data on any device
        <br />• Works even if you clear browser data or switch computers
        <br />• Share your backup ID with band members for synchronized annotations
      </div>
    </div>
  );
};