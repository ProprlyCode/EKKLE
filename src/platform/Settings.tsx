import { useState } from 'react';
import { setMyPlatformName } from '@/data/platformTeam';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Field';
import { ErrorNote } from '@/ui/states';
import { PasswordForm, PLATFORM_ROLE_LABEL, usePlatformSeat } from './PlatformGate';

/**
 * Platform → Settings: your own name and password on the Ekklē team.
 * (Managing the team itself comes with the Team tab.)
 */
export default function Settings() {
  const { seat, update } = usePlatformSeat();
  const [name, setName] = useState(seat?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!seat) return null;

  async function saveName() {
    if (!seat) return;
    setSavingName(true);
    setError(null);
    try {
      await setMyPlatformName(name);
      update({ ...seat, name: name.trim() || null });
      setNameSaved(true);
    } catch {
      setError('Couldn’t save your name.');
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-strong">
          Signed in as {seat.email} · {PLATFORM_ROLE_LABEL[seat.role]} on the Ekklē team
        </p>
      </div>

      <Card className="flex max-w-md flex-col gap-4">
        <h2 className="text-base">Your name</h2>
        <TextInput
          label="Name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameSaved(false);
          }}
        />
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button onClick={saveName} disabled={savingName} className="self-start">
          {nameSaved ? 'Saved' : savingName ? 'Saving…' : 'Save name'}
        </Button>
      </Card>

      <Card className="flex max-w-md flex-col gap-4">
        <div>
          <h2 className="text-base">{seat.password_set ? 'Change password' : 'Set a password'}</h2>
          <p className="mt-1 text-sm text-muted-strong">
            You sign in to ekkle.org with your email and this password.
          </p>
        </div>
        {passwordSaved && <p className="text-sm text-sage" role="status">Password saved.</p>}
        <PasswordForm
          submitLabel={seat.password_set ? 'Change password' : 'Set password'}
          onSaved={() => {
            setPasswordSaved(true);
            update({ ...seat, password_set: true });
          }}
        />
      </Card>
    </div>
  );
}
