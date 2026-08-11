export const getDeviceFingerprint = () => {
    let deviceId = localStorage.getItem('gk_v3_device_id');
    if (!deviceId) {
        deviceId = 'dev-' + Math.random().toString(36).substring(2, 11);
        localStorage.setItem('gk_v3_device_id', deviceId);
    }
    return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        screen: `${window.screen.width}x${window.screen.height}`,
        deviceId: deviceId,
        page: window.location.pathname
    };
};
