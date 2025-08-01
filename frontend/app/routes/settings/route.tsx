import type { Route } from "./+types/route";
import { Layout } from "../_index/components/layout/layout";
import { TopNavigation } from "../_index/components/top-navigation/top-navigation";
import { LeftNavigation } from "../_index/components/left-navigation/left-navigation";
import styles from "./route.module.css"
import { Tabs, Tab, Button } from "react-bootstrap"
import { backendClient, type ConfigItem } from "~/clients/backend-client.server";
import { redirect } from "react-router";
import { sessionStorage } from "~/auth/authentication.server";
import { isUsenetSettingsUpdated, UsenetSettings } from "./usenet/usenet";
import React from "react";
import { isSabnzbdSettingsUpdated, isSabnzbdSettingsValid, SabnzbdSettings } from "./sabnzbd/sabnzbd";
import { isWebdavSettingsUpdated, isWebdavSettingsValid, WebdavSettings } from "./webdav/webdav";

const defaultConfig = {
    "api.key": "",
    "api.categories": "",
    "usenet.host": "",
    "usenet.port": "",
    "usenet.use-ssl": "false",
    "usenet.connections": "",
    "usenet.connections-per-stream": "",
    "usenet.user": "",
    "usenet.pass": "",
    "webdav.user": "",
    "webdav.pass": "",
    "rclone.mount-dir": "",
}

export async function loader({ request }: Route.LoaderArgs) {
    // ensure user is logged in
    let session = await sessionStorage.getSession(request.headers.get("cookie"));
    let user = session.get("user");
    if (!user) return redirect("/login");

    // fetch the config items
    var configItems = await backendClient.getConfig(Object.keys(defaultConfig));

    // transform to a map
    const config: Record<string, string> = defaultConfig;
    for (const item of configItems) {
        config[item.configName] = item.configValue;
    }
    return { config: config }
}

export default function Settings(props: Route.ComponentProps) {
    return (
        <Layout
            topNavComponent={TopNavigation}
            bodyChild={<Body config={props.loaderData.config} />}
            leftNavChild={<LeftNavigation />}
        />
    );
}

type BodyProps = {
    config: Record<string, string>
};

function Body(props: BodyProps) {
    const [config, setConfig] = React.useState(props.config);
    const [newConfig, setNewConfig] = React.useState(config);
    const [isUsenetSettingsReadyToSave, setIsUsenetSettingsReadyToSave] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isSaved, setIsSaved] = React.useState(false);

    const iseUsenetUpdated = isUsenetSettingsUpdated(config, newConfig);
    const isSabnzbdUpdated = isSabnzbdSettingsUpdated(config, newConfig);
    const isWebdavUpdated = isWebdavSettingsUpdated(config, newConfig);
    const isUpdated = iseUsenetUpdated || isSabnzbdUpdated || isWebdavUpdated;

    const usenetTitle = iseUsenetUpdated ? "Usenet ✏️" : "Usenet";
    const sabnzbdTitle = isSabnzbdUpdated ? "SABnzbd ✏️" : "SABnzbd";
    const webdavTitle = isWebdavUpdated ? "WebDAV ✏️" : "WebDAV";

    const saveButtonLabel = isSaving ? "Saving..."
        : !isUpdated && isSaved ? "Saved ✅"
        : !isUpdated && !isSaved ? "There are no changes to save"
        : iseUsenetUpdated && !isUsenetSettingsReadyToSave ? "Must test the usenet connection to save"
        : isSabnzbdUpdated && !isSabnzbdSettingsValid(newConfig) ? "Invalid SABnzbd settings"
        : isWebdavUpdated && !isWebdavSettingsValid(newConfig) ? "Invalid WebDAV settings"
        : "Save";
    const saveButtonVariant = saveButtonLabel === "Save" ? "primary"
        : saveButtonLabel === "Saved ✅" ? "success"
        : "secondary";
    const isSaveButtonDisabled = saveButtonLabel !== "Save";

    // events
    const onClear = React.useCallback(() => {
        setNewConfig(config);
        setIsSaved(false);
    }, [config, setNewConfig]);

    const onUsenetSettingsReadyToSave = React.useCallback((isReadyToSave: boolean) => {
        setIsUsenetSettingsReadyToSave(isReadyToSave);
    }, [setIsUsenetSettingsReadyToSave]);

    const onSave = React.useCallback(async () => {
        setIsSaving(true);
        setIsSaved(false);
        const response = await fetch("/settings/update", {
            method: "POST",
            body: (() => {
                const form = new FormData();
                const changedConfig = getChangedConfig(config, newConfig);
                form.append("config", JSON.stringify(changedConfig));
                return form;
            })()
        });
        if (response.ok) {
            setConfig(newConfig);
        }
        setIsSaving(false);
        setIsSaved(true);
    }, [config, newConfig, setIsSaving, setIsSaved, setConfig]);

    return (
        <div className={styles.container}>
            <Tabs
                defaultActiveKey="usenet"
                className={styles.tabs}
            >
                <Tab eventKey="usenet" title={usenetTitle}>
                    <UsenetSettings config={newConfig} setNewConfig={setNewConfig} onReadyToSave={onUsenetSettingsReadyToSave}/>
                </Tab>
                <Tab eventKey="sabnzbd" title={sabnzbdTitle}>
                    <SabnzbdSettings config={newConfig} setNewConfig={setNewConfig} />
                </Tab>
                <Tab eventKey="webdav" title={webdavTitle}>
                    <WebdavSettings config={newConfig} setNewConfig={setNewConfig} />
                </Tab>
            </Tabs>
            <hr />
            {isUpdated && <Button
                className={styles.button}
                variant="secondary"
                disabled={!isUpdated}
                onClick={() => onClear()}>
                Clear
            </Button>}
            <Button
                className={styles.button}
                variant={saveButtonVariant}
                disabled={isSaveButtonDisabled}
                onClick={onSave}>
                {saveButtonLabel}
            </Button>
        </div>
    );
}

function getChangedConfig(
    config: Record<string, string>,
    newConfig: Record<string, string>
): Record<string, string> {
    let changedConfig: Record<string, string> = {};
    let configKeys = Object.keys(defaultConfig);
    for (const configKey of configKeys) {
        if (config[configKey] !== newConfig[configKey]) {
            changedConfig[configKey] = newConfig[configKey];
        }
    }
    return changedConfig;
}