const { IncomingWebhook } = require('@slack/client');

require('dotenv').config();
let webhook;
let slackMessage;

const slackCodes = {
  A_PO : 'SLACK_TEAM_MENTION_CODE',
  B_PO : 'SLACK_TEAM_MENTION_CODE',
  C_PO : 'SLACK_TEAM_MENTION_CODE',
  A_DEVELOPER : 'SLACK_TEAM_MENTION_CODE',
  B_DEVELOPER : 'SLACK_TEAM_MENTION_CODE',
  C_DEVELOPER : 'SLACK_TEAM_MENTION_CODE',
  A_TEAM : 'SLACK_TEAM_MENTION_CODE',
  B_TEAM : 'SLACK_TEAM_MENTION_CODE',
  C_TEAM : 'SLACK_TEAM_MENTION_CODE',
  USER_A : 'SLACK_USER_MENTION_CODE',
  USER_B : 'SLACK_USER_MENTION_CODE',
  USER_C : 'SLACK_USER_MENTION_CODE'
};

const statusCodes = {
  CANCELLED: {
    color: '#fbbc05',
    text: '빌드 취소' // 'Build cancelled'
  },
  FAILURE: {
    color: '#ea4335',
    text: '빌드 실패' //'Build failed'
  },
  INTERNAL_ERROR: {
    color: '#ea4335',
    text: '빌드 내부 오류' // 'Internal error encountered during build'
  },
  QUEUED: {
    color: '#fbbc05',
    text: '빌드 대기' // 'New build queued'
  },
  SUCCESS: {
    color: '#34a853',
    text: '빌드 성공' // 'Build successfully completed'
  },
  TIMEOUT: {
    color: '#ea4335',
    text: '빌드 타임아웃' // 'Build timed out'
  },
  WORKING: {
    color: '#34a853',
    text: '빌드 시작' // 'New build in progress'
  }
};

const getParsedTags = (tags, prefix) => {
  let parsedTags = tags.find(tag => tag.startsWith(prefix));

  // Mention Tag가 존재할 경우
  if (prefix.includes(process.env.PREFIX_PIC)){
    let mentions = parsedTags.split(prefix)[1].split('.');
    let str = ''
    for (let i =0; i< mentions.length; i++){
      if(mentions[i].includes('TEAM')){
        str = str + "<!subteam^" + slackCodes[mentions[i]] + "> "
      }else if(mentions[i].includes('PO')) {
        str = str + "<!subteam^" + slackCodes[mentions[i]] + "> "
      }else if(mentions[i].includes('DEVELOPER')) {
        str = str + "<!subteam^" + slackCodes[mentions[i]] + "> "
      }else{
          str = str + "<@" + slackCodes[mentions[i]] + "> "
      }
    }
    return str;
  }
  // decode the string
  return parsedTags ? Buffer.from(parsedTags.split(prefix)[1], 'base64').toString('utf-8') : "";
}

const getTriggerEventInfo = (build) => {
  let triggerEventInfo = {};
  let gitRepoName = build.substitutions.REPO_NAME;
  let commitSha = build.substitutions.SHORT_SHA;

  if(build.substitutions.TAG_NAME){
    triggerEventInfo['TRIGGER_EVENT'] = "TAG";
    triggerEventInfo['TRIGGER_EVENT_DATA'] = build.substitutions.TAG_NAME;
    triggerEventInfo['TRIGGER_EVENT_URL'] = process.env.GITHUB_URL + gitRepoName + '/releases/tag/' + triggerEventInfo['TRIGGER_EVENT_DATA'];
  }else if(build.substitutions.BRANCH_NAME){
    triggerEventInfo['TRIGGER_EVENT'] = "BRANCH";
    triggerEventInfo['TRIGGER_EVENT_DATA'] = build.substitutions.BRANCH_NAME;
    triggerEventInfo['TRIGGER_EVENT_URL'] = process.env.GITHUB_URL + gitRepoName + '/tree/' + triggerEventInfo['TRIGGER_EVENT_DATA'];
  }else{
    triggerEventInfo['TRIGGER_EVENT'] = "UNKNOWN";
    triggerEventInfo['TRIGGER_EVENT_DATA'] = "UNKNOWN";
    triggerEventInfo['TRIGGER_EVENT_URL'] = "UNKNOWN";
  }

  triggerEventInfo['COMMIT_SHA'] = commitSha;
  triggerEventInfo['COMMIT_URL'] = process.env.GITHUB_URL + gitRepoName + '/commit/' + triggerEventInfo['COMMIT_SHA'];

  return triggerEventInfo;
}

// createSlackMessage create a message from a build object.
const createSlackMessage = (build) => {
  const statusMessage = statusCodes[build.status].text;
  const cloudBuildId = build.id;
  const cloudBuildTriggerName = build.substitutions.TRIGGER_NAME;
  const logUrl = build.logUrl;

  const tags = build.tags;
  let mentions = getParsedTags(tags, process.env.PREFIX_PIC);
  let serviceName = getParsedTags(tags, process.env.PREFIX_SERVICE);
  let serviceCategory = getParsedTags(tags, process.env.PREFIX_CATEGORY);
  let applicationType = getParsedTags(tags, process.env.PREFIX_APP_TYPE);

  let triggerEventInfo = getTriggerEventInfo(build);
  let triggerEvent = triggerEventInfo['TRIGGER_EVENT'];
  let triggerEventData = triggerEventInfo['TRIGGER_EVENT_DATA'];
  let triggerEventURL = triggerEventInfo['TRIGGER_EVENT_URL'];
  let commitSHA = triggerEventInfo['COMMIT_SHA'];
  let commitURL = triggerEventInfo['COMMIT_URL'];

  const title = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `[ ${statusMessage} ] ${serviceName} ${serviceCategory} ${applicationType} ( \`${cloudBuildTriggerName}\` )`
    }
  };

  const buildStatus = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Build Log:* <${logUrl}|${cloudBuildId}>`
    }
  };

  const context = {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `*${triggerEvent}:* <${triggerEventURL}|${triggerEventData}>`
      },
      {
        type: 'mrkdwn',
        text: `*COMMIT:* <${commitURL}|${commitSHA}>`
      },
      {
          type: 'mrkdwn',
          text: `*MENTION:* ${mentions}`
      }
    ]
  };

  const message = {
    attachments: [
      {
        blocks: [
          title
        ],
        color: statusCodes[build.status].color
      }
    ]
  };

  message.attachments[0].blocks.push(buildStatus);
  // Add failure cause message when cloud build fails
  if(build.status.includes('FAILURE')){
    const cloudFailureMessage = build.failureInfo.detail;
    const failureMessage = {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Failure Message:* ${cloudFailureMessage}`
      }
    };
    message.attachments[0].blocks.push(failureMessage);
  }
  message.attachments[0].blocks.push(context);

  return message;
}

/**
 * Triggered from a message on a Cloud Pub/Sub topic.
 *
 * @param {!Object} event Event payload.
 * @param {!Object} context Metadata for the event.
 */
exports.helloPubSub  = (event, context) => {

  const build = event.data ? JSON.parse(Buffer.from(event.data, 'base64').toString()) : null;

  if (build == null) {
    return;
  }

  // Cloud build all status : 'CANCELLED', 'QUEUED', 'WORKING', 'SUCCESS', 'FAILURE', 'INTERNAL_ERROR', 'TIMEOUT'
  const status = ['QUEUED', 'CANCELLED', 'WORKING', 'SUCCESS', 'FAILURE', 'INTERNAL_ERROR', 'TIMEOUT'];
  if (status.indexOf(build.status) === -1) return;

  // Send message to Slack.
  slackMessage = createSlackMessage(build);

  const tags = build.tags;
  if (getParsedTags(tags, process.env.PREFIX_ENV).includes('DEV')){
    webhook = new IncomingWebhook(process.env.SLACK_DEV_CICD_MONITORING_WEBHOOK_URL);
  }else if(getParsedTags(tags, process.env.PREFIX_ENV).includes('PROD')){
    webhook = new IncomingWebhook(process.env.SLACK_PROD_CICD_MONITORING_WEBHOOK_URL);
  }else{
    webhook = new IncomingWebhook(process.env.SLACK_TEST_CICD_MONITORING_WEBHOOK_URL);
  }
  webhook.send(slackMessage);
};