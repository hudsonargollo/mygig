import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { saveToDatabase, loadFromDatabase, getBackupId, setBackupId, type DatabaseData } from "@/utils/cloud-storage";

interface CloudBackupProps {
  onRestore: (data: DatabaseData) => void;
  getCurrentData: () => DatabaseData;
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
      const result = await saveToDatabase(data);

      if (result.success) {
        setMessage({
          type: 'success',
          text: `Backup saved to Cloudflare database!`
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

  const handleRestore = async (userId?: string) => {
    setIsLoading(true);
    setMessage(null);

    try {
      // If userId provided, temporarily switch to that user
      const originalUserId = getBackupId();
      if (userId) {
        setBackupId(userId);
      }

      const result = await loadFromDatabase();

      if (result.success && result.data) {
        onRestore(result.data);
        setMessage({
          type: 'success',
          text: 'Data restored successfully from database!'
        });
        setShowRestore(false);
        setRestoreId("");
      } else {
        setMessage({
          type: 'error',
          text: `Restore failed: ${result.error}`
        });
        // Restore original user ID if restore failed
        if (userId && originalUserId) {
          setBackupId(originalUserId);
        }
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
        <h3 className="font-mono-ui text-sm text-foreground">DATABASE BACKUP</h3>
        <div className="flex gap-2">
          <Button
            onClick={handleBackup}
            disabled={isLoading}
            size="sm"
            variant="outline"
            className="font-mono-ui text-xs"
          >
            {isLoading ? "..." : "💾 BACKUP"}
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
          <strong>Your User ID:</strong> {currentBackupId}
          <br />
          <span className="text-green-400">Share this ID with band members for synchronized data!</span>
        </div>
      )}

      {showRestore && (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="flex gap-2">
            <Input
              placeholder="Enter user ID to restore from..."
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
          
          <Button
            onClick={() => handleRestore()}
            disabled={isLoading}
            size="sm"
            variant="outline"
            className="w-full font-mono-ui text-xs"
          >
            RESTORE MY DATA
          </Button>
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
        <strong>Cloudflare Database:</strong>
        <br />• Automatic backup to Cloudflare D1 database
        <br />• Persistent storage with high availability
        <br />• Share user ID with band members for sync
        <br />• Includes annotations, notes, audio timing, and settings
        <br />• Much faster and more reliable than external services
      </div>
    </div>
  );
};