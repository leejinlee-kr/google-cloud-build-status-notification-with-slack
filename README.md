# google-cloud-build-status-notification-with-slack

This notifier uses [Slack Webhooks](https://api.slack.com/messaging/webhooks) to send notifications to your Slack workspace.

This notifier runs as a container via Google Cloud Function and responds to events that Cloud Build publishes via its [Pub/Sub topic](https://cloud.google.com/cloud-build/docs/send-build-notifications).

For detailed instructions on setting up this notifier, see [google-cloud-build-status-notification-with-slack app code](https://github.com/leejinlee-kr/google-cloud-build-status-notification-with-slack/blob/main/index.js).