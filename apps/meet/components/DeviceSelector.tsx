import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label
} from "@pulsebeam/ui";

interface DeviceSelectorProps {
  label: string;
  value: string;
  devices: MediaDeviceInfo[];
  onValueChange: (deviceId: string) => void;
}

export function DeviceSelector({
  label,
  value,
  devices,
  onValueChange
}: DeviceSelectorProps) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {/* If 'value' is empty, the Trigger shows the Placeholder. 
          We ensure the items themselves never pass an empty string back.
      */}
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full bg-background border-border">
          <SelectValue placeholder={`Select ${label}...`} />
        </SelectTrigger>
        <SelectContent>
          {devices.length === 0 ? (
            <SelectItem value="no-devices-found" disabled>
              No devices found
            </SelectItem>
          ) : (
            devices.map(d => (
              <SelectItem key={d.deviceId} value={d.deviceId}>
                {d.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
