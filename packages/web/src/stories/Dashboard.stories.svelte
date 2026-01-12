<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, within } from 'storybook/test';
  import Dashboard from './Dashboard.svelte';

  // 1. Define Metadata
  const { Story } = defineMeta({
    title: 'Platform/Dashboard',
    component: Dashboard,
    parameters: {
      layout: 'fullscreen',
    },
    argTypes: {
      sessions: { control: 'object' },
    }
  });

  // 2. Define Mock Data
  const defaultSessions = [
    { id: "sess_01", user: "Alice Dev", role: "Publisher", codec: "VP8", bitrate: "2.4 Mbps", status: "Active" },
    { id: "sess_02", user: "Bob Ops", role: "Subscriber", codec: "H.264", bitrate: "1.1 Mbps", status: "Active" },
    { id: "sess_03", user: "Charlie QA", role: "Subscriber", codec: "AV1", bitrate: "800 Kbps", status: "Pending" },
  ];

  const heavyLoadSessions = [
    ...defaultSessions,
    { id: "sess_04", user: "David Eng", role: "Subscriber", codec: "VP9", bitrate: "1.5 Mbps", status: "Active" },
    { id: "sess_05", user: "Eve Mgr", role: "Subscriber", codec: "H.264", bitrate: "500 Kbps", status: "Active" },
    { id: "sess_06", user: "Frank Des", role: "Publisher", codec: "AV1", bitrate: "3.2 Mbps", status: "Active" },
    { id: "sess_07", user: "Grace HR", role: "Subscriber", codec: "VP8", bitrate: "100 Kbps", status: "Pending" },
  ];
</script>

<!-- 3. Standard Stories -->

<Story name="Default" args={{ sessions: defaultSessions }} />

<Story name="Empty State" args={{ sessions: [] }} />

<Story name="Heavy Load" args={{ sessions: heavyLoadSessions }} />

<!-- 4. Story with Interaction Test (The "play" function) -->
<Story 
  name="Live Status Check" 
  args={{ sessions: defaultSessions }}
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify the page title loads
    const title = canvas.getByText('System Overview');
    await expect(title).toBeInTheDocument();

    // Verify a specific user from the data is present in the table
    const user = canvas.getByText('Alice Dev');
    await expect(user).toBeInTheDocument();

    // Verify the "Operational" status is visible in the stats
    const health = canvas.getByText('Operational');
    await expect(health).toBeInTheDocument();
  }}
/>

<!-- 5. Dark Mode Preview (Using a wrapper slot) -->
<Story name="Dark Mode">
  <div class="dark bg-background text-foreground min-h-screen">
    <Dashboard sessions={defaultSessions} />
  </div>
</Story>
