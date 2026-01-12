<script lang="ts">
  import {
    Activity,
    Server,
    Users,
    Settings,
    Shield,
    Copy,
  } from "@lucide/svelte";

  import {
    Card,
    Table,
    Tabs,
    Avatar,
    Button,
    Input,
    Label,
    Switch,
    Slider,
    Badge,
  } from "$lib/index.ts";

  // Made this an export so Storybook can control it
  export let sessions = [
    {
      id: "sess_01",
      user: "Alice Dev",
      role: "Publisher",
      codec: "VP8",
      bitrate: "2.4 Mbps",
      status: "Active",
    },

    {
      id: "sess_02",
      user: "Bob Ops",
      role: "Subscriber",
      codec: "H.264",
      bitrate: "1.1 Mbps",
      status: "Active",
    },

    {
      id: "sess_03",
      user: "Charlie QA",
      role: "Subscriber",
      codec: "AV1",
      bitrate: "800 Kbps",
      status: "Pending",
    },
  ];
</script>

<div class="min-h-screen bg-muted/20 pb-10">
  <!-- Navigation / Header -->
  <header class="bg-background border-b border-border sticky top-0 z-10">
    <div class="container mx-auto px-6 h-16 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <img
          src="https://pulsebeam.dev/favicon.svg"
          class="h-10 w-10"
          alt="pulsebeam logo"
        />
        <span class="font-bold text-lg tracking-tight">
          PulseBeam
          <span class="text-muted-foreground font-normal">Console</span>
        </span>
      </div>
      <nav
        class="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground"
      >
        <a
          href="##"
          class="text-foreground hover:text-primary transition-colors"
        >
          Overview
        </a>
        <a href="##" class="hover:text-foreground transition-colors"> Nodes </a>
        <a href="##" class="hover:text-foreground transition-colors"> Usage </a>
        <a href="##" class="hover:text-foreground transition-colors">
          Settings
        </a>
      </nav>
      <div class="flex items-center gap-4">
        <Button variant="outline" size="sm">Documentation</Button>
        <Avatar.Root class="h-8 w-8">
          <Avatar.Image
            src="https://github.com/lherman-cs.png"
            alt="@lherman-cs"
          />
          <Avatar.Fallback>AD</Avatar.Fallback>
        </Avatar.Root>
      </div>
    </div>
  </header>
  <main class="container mx-auto px-6 py-8 space-y-8">
    <!-- Hero / Actions -->
    <div
      class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
    >
      <div>
        <h1 class="text-3xl font-bold tracking-tight">System Overview</h1>
        <p class="text-muted-foreground mt-1">
          Manage your WebRTC clusters and media flows.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline"
          ><Settings class="mr-2 size-4" />Configure</Button
        >
        <Button><Server class="mr-2 size-4" />Deploy Node</Button>
      </div>
    </div>
    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card.Root>
        <Card.Header
          class="flex flex-row items-center justify-between space-y-0 pb-2"
        >
          <Card.Title class="text-sm font-medium">Active Connections</Card.Title
          >
          <Users class="h-4 w-4 text-muted-foreground" />
        </Card.Header>
        <Card.Content>
          <div class="text-2xl font-bold">1,248</div>
          <p class="text-xs text-muted-foreground mt-1">+12% from last hour</p>
        </Card.Content>
      </Card.Root>
      <Card.Root>
        <Card.Header
          class="flex flex-row items-center justify-between space-y-0 pb-2"
        >
          <Card.Title class="text-sm font-medium">Network Egress</Card.Title>
          <Activity class="h-4 w-4 text-muted-foreground" />
        </Card.Header>
        <Card.Content>
          <div class="text-2xl font-bold">4.8 Gbps</div>
          <p class="text-xs text-muted-foreground mt-1">
            Peaking at 85% capacity
          </p>
        </Card.Content>
      </Card.Root>
      <Card.Root>
        <Card.Header
          class="flex flex-row items-center justify-between space-y-0 pb-2"
        >
          <Card.Title class="text-sm font-medium">SFU Health</Card.Title>
          <Shield class="h-4 w-4 text-primary" />
        </Card.Header>
        <Card.Content>
          <div
            class="text-2xl font-bold text-green-600 flex items-center gap-2"
          >
            Operational
            <span class="relative flex h-3 w-3">
              <span
                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"
              ></span>
              <span
                class="relative inline-flex rounded-full h-3 w-3 bg-green-500"
              ></span>
            </span>
          </div>
          <p class="text-xs text-muted-foreground mt-1">Uptime: 99.99%</p>
        </Card.Content>
      </Card.Root>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Main Content: Sessions Table -->
      <div class="lg:col-span-2 space-y-6">
        <Card.Root class="h-full">
          <Card.Header>
            <Card.Title>Live Sessions</Card.Title>
            <Card.Description>
              Real-time view of publishers and subscribers on Node-01.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <Table.Root>
              <Table.Caption>A list of recent WebRTC sessions.</Table.Caption>
              <Table.Header>
                <Table.Row>
                  <Table.Head class="w-[100px]">ID</Table.Head>
                  <Table.Head>User</Table.Head>
                  <Table.Head>Role</Table.Head>
                  <Table.Head>Codec</Table.Head>
                  <Table.Head class="text-right">Bitrate</Table.Head>
                  <Table.Head class="text-right">Status</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each sessions as session}
                  <Table.Row>
                    <Table.Cell class="font-medium font-mono text-xs">
                      {session.id}
                    </Table.Cell>
                    <Table.Cell class="flex items-center gap-2">
                      <Avatar.Root class="h-6 w-6">
                        <Avatar.Fallback class="text-[10px]"
                          >{session.user
                            .substring(0, 2)
                            .toUpperCase()}</Avatar.Fallback
                        >
                      </Avatar.Root>
                      {session.user}
                    </Table.Cell>
                    <Table.Cell>{session.role}</Table.Cell>
                    <Table.Cell>
                      <Badge variant="secondary" class="font-mono font-normal">
                        {session.codec}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell class="text-right">{session.bitrate}</Table.Cell
                    >
                    <Table.Cell class="text-right">
                      {#if session.status === "Active"}
                        <Badge class="bg-primary hover:bg-primary/90"
                          >Active</Badge
                        >
                      {:else}
                        <Badge variant="outline" class="text-muted-foreground">
                          Pending
                        </Badge>
                      {/if}
                    </Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </Card.Content>
          <Card.Footer class="justify-between border-t p-4 bg-muted/10">
            <span class="text-xs text-muted-foreground"
              >Updated 3 seconds ago</span
            >
            <Button variant="ghost" size="sm" class="text-xs">
              View All Logs
            </Button>
          </Card.Footer>
        </Card.Root>
      </div>
      <!-- Right Column: Configuration -->
      <div class="space-y-6">
        <!-- API Keys -->
        <Card.Root>
          <Card.Header>
            <Card.Title class="text-lg">API Configuration</Card.Title>
          </Card.Header>
          <Card.Content class="space-y-4">
            <div class="space-y-2">
              <Label for="key">Public Key</Label>
              <div class="flex gap-2">
                <Input
                  id="key"
                  value="pk_live_51M..."
                  readonly
                  class="font-mono text-xs"
                />
                <Button variant="outline" size="icon"
                  ><Copy class="h-4 w-4" /></Button
                >
              </div>
            </div>
            <div class="space-y-2">
              <Label for="secret">Secret Key</Label>
              <Input id="secret" type="password" value="sk_test_..." />
            </div>
          </Card.Content>
        </Card.Root>
        <!-- Media Config -->
        <Card.Root>
          <Card.Header>
            <Card.Title class="text-lg">Media Settings</Card.Title>
            <Card.Description>Global ingest configurations.</Card.Description>
          </Card.Header>
          <Card.Content>
            <Tabs.Root value="video" class="w-full">
              <Tabs.List class="grid w-full grid-cols-2 mb-4">
                <Tabs.Trigger value="video">Video</Tabs.Trigger>
                <Tabs.Trigger value="audio">Audio</Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="video" class="space-y-4">
                <div
                  class="flex items-center justify-between rounded-lg border p-3 shadow-sm"
                >
                  <div class="space-y-0.5">
                    <Label class="text-base">Simulcast</Label>
                    <p class="text-xs text-muted-foreground">
                      Auto-scale quality tiers
                    </p>
                  </div>
                  <Switch checked />
                </div>
                <div class="space-y-3 pt-2">
                  <div class="flex justify-between">
                    <Label>Max Ingest Bitrate</Label>
                    <span class="text-xs text-muted-foreground">4.5 Mbps</span>
                  </div>
                  <Slider value={[75]} max={100} step={1} />
                </div>
              </Tabs.Content>
              <Tabs.Content value="audio">
                <div class="p-4 text-center text-sm text-muted-foreground">
                  Audio settings panel placeholder.
                </div>
              </Tabs.Content>
            </Tabs.Root>
          </Card.Content>
          <Card.Footer><Button class="w-full">Save Changes</Button></Card.Footer
          >
        </Card.Root>
      </div>
    </div>
  </main>
</div>
