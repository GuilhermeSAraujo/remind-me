import { ChangeStreamInsertDocument } from "mongodb";
import { PremiumPayment, IPremiumPayment } from "../domain/payments/premium-payment.model";
import { User } from "../domain/users/user.model";
import { sendMessage } from "../integrations/whatsapp/send-message";
import { PREMIUM_WELCOME_MESSAGE } from "../integrations/whatsapp/constants";
import { env } from "../config/env";

const startPremiumPaymentWatcher = async () => {
    if (env.LOCAL_TEST_MODE) {
        return;
    }

    try {
        console.info("[PREMIUM WATCHER] Starting Premium Payment Change Stream...");

        // Create change stream with pipeline to filter only inserts with messageSent: false
        const changeStream = PremiumPayment.watch(
            [
                {
                    $match: {
                        operationType: "insert",
                        "fullDocument.messageSent": false,
                    },
                },
            ],
            {
                fullDocument: "updateLookup",
            },
        );

        changeStream.on("change", async (change: ChangeStreamInsertDocument<IPremiumPayment>) => {
            try {
                console.info("[PREMIUM WATCHER] New premium payment detected:", change.fullDocument);

                const userPhoneNumber = change.fullDocument?.userPhoneNumber;
                const paymentId = change.fullDocument?._id;

                if (!userPhoneNumber || !paymentId) {
                    console.error("[PREMIUM WATCHER] Missing userPhoneNumber or paymentId");
                    return;
                }

                // Fetch user data
                const user = await User.findOne({ phoneNumber: userPhoneNumber });

                if (!user) {
                    console.error(`[PREMIUM WATCHER] User not found: ${userPhoneNumber}`);
                    // Mark as sent even if user not found to avoid retrying
                    await PremiumPayment.updateOne({ _id: paymentId }, { messageSent: true });
                    return;
                }

                // Send message via WhatsApp
                const messageSent = await sendMessage({
                    phone: userPhoneNumber,
                    message: PREMIUM_WELCOME_MESSAGE,
                });

                if (messageSent) {
                    console.info(`[PREMIUM WATCHER] Welcome message sent to ${userPhoneNumber}`);

                    // Update messageSent flag
                    await PremiumPayment.updateOne({ _id: paymentId }, { messageSent: true });
                } else {
                    console.error(`[PREMIUM WATCHER] Failed to send message to ${userPhoneNumber}`);
                    // Don't update messageSent so it can be retried
                }
            } catch (error) {
                console.error("[PREMIUM WATCHER] Error processing change:", error);
            }
        });

        changeStream.on("error", (error) => {
            console.error("[PREMIUM WATCHER] Change stream error:", error);
            // Attempt to restart the watcher after a delay
            setTimeout(() => {
                console.info("[PREMIUM WATCHER] Attempting to restart...");
                startPremiumPaymentWatcher();
            }, 5000);
        });

        changeStream.on("end", () => {
            console.warn("[PREMIUM WATCHER] Change stream ended");
            // Attempt to restart the watcher
            setTimeout(() => {
                console.info("[PREMIUM WATCHER] Attempting to restart...");
                startPremiumPaymentWatcher();
            }, 5000);
        });

        console.info("[PREMIUM WATCHER] Successfully started and listening for changes");
    } catch (error) {
        console.error("[PREMIUM WATCHER] Failed to start watcher:", error);

        // Check if it's a replica set error
        if (error instanceof Error && error.message.includes("replica set")) {
            console.warn("[PREMIUM WATCHER] MongoDB Change Streams require a replica set configuration");
        }

        // Retry after delay
        setTimeout(() => {
            console.info("[PREMIUM WATCHER] Attempting to restart...");
            startPremiumPaymentWatcher();
        }, 10000);
    }
};

// Start the watcher
startPremiumPaymentWatcher();
