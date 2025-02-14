# PulseBeam WebRTC DataChannel Example

### Run Demo
1. Install dependencies with `npm i`
1. Run with `npm start`
1. Go to your browser open two tabs: 
    - URL for first tab: `http://localhost:3000/?development=true&peerId=peer-29`
    - URL for second tab: `http://localhost:3000/?development=true`
1. On the second tab say `peer-29` in the first text box. Then click connect.
1. You can edit the text in the bottom text box. And see it synchronizing between the peers. 
1. Note: This demo will work globally within the scope of your project-id (not just two tabs within the same browser!). So feel free to have the one peer on a different network or machine.
1. If desired, go to inspector, console to see logs on either tab

### So [what happened?](https://pulsebeam.dev/docs/getting-started/what-happened/)

### For more information, see [related docs](https://pulsebeam.dev/docs/getting-started/quick-start/) 

### Unfamiliar terms? See [glossary](https://pulsebeam.dev/docs/concepts/terms/)

### When running our demos locally, PulseBeam convention states:
* Demo will use the local `/auth` server defined here (in `../demo-server`)
* Adding `development=true` as a URL parameter will use insecure [development auth](https://pulsebeam.dev/docs/getting-started/quick-start/)

### Our demos:
* Data channel `demo-cdn`, our [quickstart demo](https://pulsebeam.dev/docs/getting-started/quick-start/)
* Video `../demo-react`, our [video chat demo](https://meet.pulsebeam.dev/)

### For questions, [contact us](https://pulsebeam.dev/docs/community-and-support/support/)