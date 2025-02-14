# PulseBeam WebRTC Video Call Example

### Run Demo
1. `npm i`
1. Set key (get key [here](https://cloud.pulsebeam.dev/))
    ```
    export PULSEBEAM_API_KEY=kid_<...>
    export PULSEBEAM_API_SECRET=sk_<...>
    ```
1. `npm run dev`

### Use Demo
1. Go to your browser open two tabs: 
    - URL for first tab: `http://localhost:5174/`
    - URL for second tab: `http://localhost:5174/`
1. In each tab enter a name (e.g. alice, bob)
1. In one tab, enter the other's name into one tab (e.g. alice call bob)
1. Click connect, and the peers will connect to each other in a video call
1. Note: This demo will work globally within the scope of your project-id (not just two tabs within the same browser!). So feel free to have the one peer on a different network or machine.
1. If desired, go to inspector, console to see logs on either tab

### Unfamiliar terms? See [glossary](https://pulsebeam.dev/docs/concepts/terms/)

### So what happened? See [concepts](https://pulsebeam.dev/docs/concepts/terms/)

### When running our demos locally, PulseBeam convention states:
* Demo will use the local `/auth` server defined here (in `../demo-server`)
* Adding `development=true` as a URL parameter will use insecure [development auth](https://pulsebeam.dev/docs/getting-started/quick-start/)

### Our demos:
* Data channel `../demo-cdn`, our [quickstart demo](https://pulsebeam.dev/docs/getting-started/quick-start/)
* Video `demo-react`, our [video chat demo](https://meet.pulsebeam.dev/)

### For questions, [contact us](https://pulsebeam.dev/docs/community-and-support/support/)