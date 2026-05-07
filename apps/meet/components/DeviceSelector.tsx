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
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full bg-background border-border hover:bg-accent/50 transition-colors">
          <SelectValue placeholder={`Select ${label}...`} />
        </SelectTrigger>
        <SelectContent>
          {devices.length === 0 ? (
            <SelectItem value="none" disabled>No devices found</SelectItem>
          ) : (
            devices.map((device, index) => (
              <SelectItem key={device.deviceId || index} value={device.deviceId}>
                {device.label || `${label} ${index + 1}`}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
