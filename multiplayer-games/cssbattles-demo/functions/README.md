For production deployment to firebase you can set environment variables in the Firebase console 

OR

Use the CLI:

firebase functions:config:set pulsebeam.api_key="kid_<...>" pulsebeam.api_secret="sk_<...>"
firebase deploy --only functions