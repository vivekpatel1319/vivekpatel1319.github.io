(function () {
    //--- SETTINGS START ---

    /*
        Client settings
     */
    let displayName = 'Guest demo client II';
    let firstName = 'First name II';
    let lastName = 'Last name II';

    /*
        SDK settings
     */

    // Customer organizzation ID
    const organizationId = '96f271bd-dd74-455a-879b-6c4108c69548';

    // Deployment ID
    // You must create one in your admin panel under Web Chat  in
    // https://apps.mypurecloud.com/directory/#/admin/integrations/chat
    const deploymentId = '8dabda89-7e48-4d22-a7d2-db594ad47082';


    // SmartVideo cloud address
    const veUrl = 'https://videome.leadsecure.com/';

    // SmartVideo ID, Provided by VideoEngager
    const tenantId = 'Noe9kKdcK8TnACvn';

    // PureCloud region
    const environment = 'mypurecloud.com';


    // Inbound Chat queue.
    // Chat queue for the agents that will receive video calls.
    const queueName = 'Patel ACD Queue';  

    // Start with camera on or off.
    // true - ignore SmartVideo setting 'Customer starts the call with camera ON'
    // false - use SmartVideo setting 'Customer starts the call with camera ON'
    const video_on = false;

    /*
        SDK Debug settings
     */
    const returnExtendedResponses = false;
    const enableDebugLogging = false;

    //--- SETTINGS END ---

    let chatId;
    let memberId;
    let jwt;
    let interactionId;

    const platformClient = require("platformClient");
    const client = platformClient.ApiClient.instance;

    /**
     * Configures purecloud's sdk (enables debugging, sets correct environment)
     * @param {string} client platformClient.ApiClient.instance
     * @param {string} environment purecloud environment. Example: mypurecloud.com
     * @param {boolean} returnExtendedResponses
     * @param {boolean} enableDebugLogging
     */
    const configureSDK = function (client, environment, returnExtendedResponses, enableDebugLogging) {
        client.setEnvironment(environment);
        client.setReturnExtendedResponses(returnExtendedResponses);

        if (enableDebugLogging) {
            client.setDebugLog(console.log);
        }
    };

    /**
     * Generates random GUID string
     * @returns {string} GUID
     */
    const getGuid = function() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }

        return (
            s4() +
            s4() +
            "-" +
            s4() +
            "-" +
            s4() +
            "-" +
            s4() +
            "-" +
            s4() +
            s4() +
            s4()
        );
    };

    /**
     * Gets cookie value
     * @param {string} name cookie name
     * @returns {string|null} cookie value or undentified if cookie doesnt exists
     */
    const getCookie = function(name) {
        var pattern = new RegExp(name + "=.[^;]*");
        var matched = document.cookie.match(pattern);
        if (matched) {
            var cookie = matched[0].split("=");
            var cooki = decodeURIComponent(cookie[1]).replace(
                /"/g,
                ""
            );
            return cooki;
        }
        return null;
    };

    /**
     * Creates cookie with value and expiration time in hours
     * @param {string} name
     * @param {string} value
     * @param {number} hour time to live in hours
     */
    const setCookie = function(name, value, hour) {
        var cookieName = name;
        var cookieValue = value;
        var d = new Date();
        var time = d.getTime();
        var expireTime = time + 1000 * 60 * 60 * parseInt(hour);
        d.setTime(expireTime);
        if (hour) {
            document.cookie =
                cookieName +
                "=" +
                cookieValue +
                ";expires=" +
                d.toGMTString() +
                ";path=/";
        } else {
            document.cookie =
                cookieName + "=" + cookieValue + ";path=/";
        }
    };

    /**
     * Load videoengager ui
     * @param {string} veUrl
     * @param {string} interactionId
     * @param {string} tenantId
     */
    const loadUI = function (veUrl, interactionId, tenantId) {
        let str = {
            video_on: video_on,
            sessionId: interactionId,
            hideChat: true,
            type: "initial",
            defaultGroup: "floor",
            view_widget: "4",
            offline: true,
            aa: true,
            inichat: "false"
        };
        let encodedString = window.btoa(JSON.stringify(str));
        let url = `${veUrl}/static/popup.html?tennantId=${window.btoa(tenantId)}&params=${encodedString}`;
        $("#videoengageriframe").attr("src", url);
    };

    /**
     * Sends interaction id
     * @param chatId
     * @param memberId
     * @param interactionId
     */
    const sendInteractionId = function (chatId, memberId, interactionId) {
        var postData = {
            body: `{"interactionId": "${interactionId}"}`
        };

        $.ajax({
            url:
                `https://api.${environment}/api/v2/webchat/guest/conversations/${chatId}/members/${memberId}/messages`,
            type: "POST",
            data: JSON.stringify(postData),
            contentType: "application/json",
            beforeSend: function(xhr) {
                xhr.setRequestHeader(
                    "Authorization",
                    "bearer " + jwt
                );
            },
            complete: function() {
                if (enableDebugLogging) {
                    console.log('successfully sent interactionId');
                }
            },
            error: function(err) {
                console.error('unable to sent interactionId');
                console.log("error", err);
            }
        });
    };

    /**
     * Sets interactionId variable to interactionId (generated or using preexisting)
     */
    const setInteractionId = function () {
        interactionId = getCookie("interactionId");
        if (interactionId == undefined) {
            interactionId = getGuid();
            setCookie("interactionId", interactionId, 24);
        }
    };

    /**
     * Callback executed when client is successfully connected to conversation
     */
    const onConnected = function (interactionId) {
        sendInteractionId(chatId, memberId, interactionId);
        loadUI(veUrl, interactionId, tenantId);
    };

    /**
     * Callback executed when message event is received from mypurecloud api
     * @param data received json
     */
    const onReceivedMessageFromConversation = function (data) {
        if (
            data.eventBody &&
            data.eventBody.body &&
            data.eventBody.body.indexOf(veUrl) !== -1
        ) {
            const url = data.eventBody.body;
            $("#response").append(`<p><a href='${url}' target='videoengageriframe' class='blink_me'>Accept Incoming Video Chat</a></p>`);
        }
    };

    /**
     * Callback executed when socked receives message
     * @param event socket event param
     */
    const onReceivedMessageEventFromSocket = function (event) {
        console.log("onReceivedMessageEventFromSocket started", event);
        const message = JSON.parse(event.data);
        if (message.metadata) {
            switch (message.metadata.type) {
                case 'message': {
                    onReceivedMessageFromConversation(message);
                    break;
                }
                case 'member-change': {
                    console.log("member-change called1", message.eventBody);
                    console.log("member-change called2", message.eventBody.member.id);
                    console.log("member-change called3", memberId);
                    console.log("member-change called4", message.eventBody.member.id === memberId);
                    if (message.eventBody && message.eventBody.member.id === memberId) {
                        console.log("member-change called5", interactionId);
                        onConnected(interactionId);
                    }
                    break;
                }
            }
        }
    };

    /**
     * Executed when clicked on start video button
     * @param interactionId
     */
    const startVideoButtonClickHandler = function () {
        // Create API instance
        const webChatApi = new platformClient.WebChatApi();
        const createChatBody = {
            organizationId: organizationId,
            deploymentId: deploymentId,
            routingTarget: {
                targetType: "QUEUE",
                targetAddress: queueName
            },
            memberInfo: {
                displayName: displayName,
                customFields: {
                    firstName: firstName,
                    lastName: lastName
                }
            }
        };

        // Create chat
        webChatApi
            .postWebchatGuestConversations(createChatBody)
            .then(createChatResponse => {
                let chatInfo = createChatResponse.body ? createChatResponse.body : createChatResponse;

                client.setJwt(chatInfo.jwt);

                let socket = new WebSocket(chatInfo.eventStreamUri);

                chatId = chatInfo.id;
                memberId = chatInfo.member.id;
                jwt = chatInfo.jwt;

                // Listen for messages
                socket.addEventListener("message", onReceivedMessageEventFromSocket);
            })
            .catch(console.error);
    };

    $(document).ready(function() {
        setInteractionId();
        configureSDK(client, environment, returnExtendedResponses, enableDebugLogging);
        $("#clickButton").on("click", startVideoButtonClickHandler);
    });
})();
