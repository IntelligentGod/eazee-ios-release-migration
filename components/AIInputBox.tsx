import React, { ReactNode, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Image,
    ImageSourcePropType,
    Text,
    TextInput,
    TextInputProps,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MIcon from '@expo/vector-icons/MaterialCommunityIcons';

type AIInputSurfaceVariant = 'default' | 'allinity3d' | 'chatAsset' | 'todoAsset';
type AssetSurfaceVariant = Exclude<AIInputSurfaceVariant, 'default'>;
type MicrophoneSide = 'left' | 'right';

interface AIInputBoxProps {
    textInput: string;
    isListening: boolean;
    microphoneColor: string;
    glowAnim: Animated.Value;
    placeholder?: string;
    editable?: boolean;
    showSoftInputOnFocus?: boolean;
    caretHidden?: boolean;
    showSendButton?: boolean;
    isProcessing?: boolean;
    processingLabel?: string;
    inputRef?: React.Ref<TextInput>;
    onChangeText?: (text: string) => void;
    onSubmitEditing?: () => void;
    onSendPress?: () => void;
    voicePreviewContent?: ReactNode;
    onFocus?: () => void;
    onBlur?: () => void;
    returnKeyType?: TextInputProps['returnKeyType'];
    autoCapitalize?: TextInputProps['autoCapitalize'];
    blurOnSubmit?: boolean;
    multiline?: boolean;
    minInputHeight?: number;
    maxInputHeight?: number;
    onHeightChange?: (height: number) => void;
    inputWrapper?: (children: ReactNode) => ReactNode;
    surfaceVariant?: AIInputSurfaceVariant;
    onTextInputPress: () => void;
    onMicrophonePress: () => void;
    onMicrophoneLongPress?: () => void;
    onMicrophonePressOut?: () => void;
    microphoneDelayLongPress?: number;
    microphoneWrapper?: (children: ReactNode) => ReactNode;
    inputRingLeftColor?: string;
    inputRingRightColor?: string;
    inputBgLeftColor?: string;
    inputBgColor?: string;
    inputStrokeColor?: string;
    inputStrokeTopColor?: string;
    inputStrokeBottomColor?: string;
    inputStrokeLeftColor?: string;
    inputStrokeRightColor?: string;
    inputStrokeWidth?: number;
    micBgLeftColor?: string;
    micBgColor?: string;
    micStrokeColor?: string;
    micStrokeWidth?: number;
    microphoneSide?: MicrophoneSide;
    containerStyle?: ViewStyle;
}

interface AssetSurfaceConfig {
    inputSource: ImageSourcePropType;
    microphoneSource: ImageSourcePropType;
    sendSource?: ImageSourcePropType;
    sendArrowSource?: ImageSourcePropType;
    sendArrowBounds?: {
        sourceWidth: number;
        sourceHeight: number;
        left: number;
        top: number;
        width: number;
        height: number;
    };
    sendSourceBounds?: {
        sourceWidth: number;
        sourceHeight: number;
        left: number;
        top: number;
        width: number;
        height: number;
    };
    textColor: string;
    placeholderTextColor: string;
    idleMicrophoneColor: string;
    sendOuterColors: readonly [string, string, string];
    sendInnerColor: string;
    sendIconColor: string;
    sendBorderColor: string;
    lineHeight: number;
}

const assetSurfaceConfigs: Record<AssetSurfaceVariant, AssetSurfaceConfig> = {
    allinity3d: {
        inputSource: require('../assets/images/home-ai-chat-2.png'),
        microphoneSource: require('../assets/images/home-ai-mic.png'),
        sendSource: require('../assets/images/home-ai-send.png'),
        sendArrowSource: require('../assets/images/home-ai-arrow.png'),
        sendArrowBounds: {
            sourceWidth: 1024,
            sourceHeight: 1536,
            left: 234,
            top: 345,
            width: 548,
            height: 901,
        },
        sendSourceBounds: {
            sourceWidth: 1024,
            sourceHeight: 724,
            left: 373,
            top: 279,
            width: 263,
            height: 164,
        },
        textColor: '#F4EFCF',
        placeholderTextColor: 'rgba(244,239,207,0.64)',
        idleMicrophoneColor: '#E6E0BD',
        sendOuterColors: ['#6E6A46', '#D0CC95', '#FFF7BD'],
        sendInnerColor: '#3D3A33',
        sendIconColor: '#E6E0BD',
        sendBorderColor: 'rgba(255, 247, 205, 0.48)',
        lineHeight: 19,
    },
    chatAsset: {
        inputSource: require('../assets/images/chat-ai-chat.png'),
        microphoneSource: require('../assets/images/chat-ai-voice.png'),
        sendSource: require('../assets/images/chat-ai-send.png'),
        sendArrowSource: require('../assets/images/chat-ai-arrow.png'),
        sendSourceBounds: {
            sourceWidth: 1024,
            sourceHeight: 724,
            left: 0,
            top: 10,
            width: 1013,
            height: 706,
        },
        textColor: '#E8FFFC',
        placeholderTextColor: 'rgba(232,255,252,0.6)',
        idleMicrophoneColor: '#CBFFF3',
        sendOuterColors: ['#1A5960', '#7DF8FD', '#D5FFFF'],
        sendInnerColor: '#215B63',
        sendIconColor: '#E9FFFB',
        sendBorderColor: 'rgba(223, 255, 255, 0.98)',
        lineHeight: 18,
    },
    todoAsset: {
        inputSource: require('../assets/images/todo-ai-chat.png'),
        microphoneSource: require('../assets/images/todo-ai-voice.png'),
        textColor: '#E8FFF7',
        placeholderTextColor: 'rgba(232,255,247,0.6)',
        idleMicrophoneColor: '#D6FFF4',
        sendOuterColors: ['#175C57', '#77F2E4', '#DAFFF7'],
        sendInnerColor: '#1E645C',
        sendIconColor: '#E9FFF8',
        sendBorderColor: 'rgba(225, 255, 244, 0.98)',
        lineHeight: 18,
    },
};

const assetSurfaceLayout = {
    inputMarginLeft: 12,
    inputMarginRight: 5,
    inputHorizontalInset: 14,
    inputVerticalInset: 4,
    inputHorizontalOverscan: 2,
    microphoneWidth: 74,
    microphoneHeight: 45,
    microphoneMarginLeft: 5,
    microphoneMarginRight: 14,
    microphoneMarginVertical: 8,
};

function GlowRing({
    glowAnim,
    borderRadius,
}: {
    glowAnim: Animated.Value;
    borderRadius: number;
}) {
    return (
        <Animated.View
            pointerEvents="none"
            style={{
                position: 'absolute',
                top: -2,
                left: -2,
                right: -2,
                bottom: -2,
                borderRadius: borderRadius + 2,
                borderWidth: 3,
                borderColor: '#AEFFE8',
                backgroundColor: 'rgba(174, 255, 232, 0.08)',
                shadowColor: '#AEFFE8',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.55,
                shadowRadius: 9,
                elevation: 12,
                opacity: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.92, 0.34],
                }),
                transform: [{
                    scale: glowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.025],
                    }),
                }],
            }}
        />
    );
}

function AssetSurface({
    source,
    style,
    contentStyle,
    children,
}: {
    source: ImageSourcePropType;
    style?: ViewStyle;
    contentStyle?: ViewStyle;
    children: ReactNode;
}) {
    return (
        <View style={style}>
            <Image
                source={source}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: -assetSurfaceLayout.inputHorizontalOverscan,
                    right: -assetSurfaceLayout.inputHorizontalOverscan,
                    bottom: 0,
                    width: undefined,
                    height: undefined,
                }}
                resizeMode="stretch"
            />
            <View
                style={{
                    flex: 1,
                    marginHorizontal: assetSurfaceLayout.inputHorizontalInset,
                    marginVertical: assetSurfaceLayout.inputVerticalInset,
                }}
            >
                <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
            </View>
        </View>
    );
}

function SendButton({
    assetConfig,
    defaultColors,
    defaultBorderColor,
    defaultBorderWidth,
    isExpandedMultiline,
    bottomOffset,
    onPress,
    rightOffset,
}: {
    assetConfig?: AssetSurfaceConfig;
    defaultColors: readonly [string, string];
    defaultBorderColor: string;
    defaultBorderWidth: number;
    isExpandedMultiline: boolean;
    bottomOffset?: number;
    onPress?: () => void;
    rightOffset?: number;
}) {
    const size = assetConfig ? 22 : 22;
    const radius = size / 2;

    return (
        <TouchableOpacity
            onPress={onPress}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            style={{
                position: 'absolute',
                right: rightOffset ?? (assetConfig ? -2 : 6),
                top: isExpandedMultiline ? undefined : '50%',
                bottom: isExpandedMultiline ? (bottomOffset ?? (assetConfig ? 6 : 8)) : undefined,
                marginTop: isExpandedMultiline ? 0 : -radius,
                width: size,
                height: size,
                borderRadius: radius,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                zIndex: 30,
                shadowColor: assetConfig ? '#041317' : '#000000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: assetConfig ? 0.34 : 0,
                shadowRadius: assetConfig ? 8 : 0,
                elevation: assetConfig ? 8 : 0,
            }}
        >
            {assetConfig ? (
                <>
                    <LinearGradient
                        colors={assetConfig.sendOuterColors}
                        start={{ x: 0.12, y: 0.88 }}
                        end={{ x: 0.88, y: 0.12 }}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            borderRadius: radius,
                            padding: 2,
                        }}
                    >
                        <View
                            style={{
                                flex: 1,
                                borderRadius: radius - 2,
                                backgroundColor: assetConfig.sendInnerColor,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <MIcon name="arrow-up-bold" size={15} color={assetConfig.sendIconColor} />
                        </View>
                    </LinearGradient>
                    <View
                        pointerEvents="none"
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            borderRadius: radius,
                            borderWidth: 1,
                            borderColor: assetConfig.sendBorderColor,
                        }}
                    />
                    <View
                        pointerEvents="none"
                        style={{
                            position: 'absolute',
                            top: 1,
                            left: 1,
                            right: 1,
                            height: radius - 1,
                            borderRadius: radius,
                            backgroundColor: 'rgba(255,255,255,0.12)',
                        }}
                    />
                </>
            ) : (
                <>
                    <LinearGradient
                        colors={defaultColors}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            borderRadius: radius,
                        }}
                    />
                    <View
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            borderRadius: radius,
                            borderWidth: defaultBorderWidth,
                            borderColor: defaultBorderColor,
                        }}
                    />
                    <MIcon name="arrow-up" size={15} color="#FFFFFF" />
                </>
            )}
        </TouchableOpacity>
    );
}

function MicrophoneButton({
    assetConfig,
    glowAnim,
    isListening,
    isProcessing,
    microphoneColor,
    onPress,
    onLongPress,
    onPressOut,
    delayLongPress,
    onSendPress,
    sendMode,
    micBgLeftColor,
    micBgColor,
    micStrokeColor,
    micStrokeWidth,
    microphoneSide,
}: {
    assetConfig?: AssetSurfaceConfig;
    glowAnim: Animated.Value;
    isListening: boolean;
    isProcessing: boolean;
    microphoneColor: string;
    onPress: () => void;
    onLongPress?: () => void;
    onPressOut?: () => void;
    delayLongPress?: number;
    onSendPress?: () => void;
    sendMode: boolean;
    micBgLeftColor?: string;
    micBgColor: string;
    micStrokeColor: string;
    micStrokeWidth: number;
    microphoneSide: MicrophoneSide;
}) {
    const sendTransition = useRef(new Animated.Value(sendMode ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(sendTransition, {
            toValue: sendMode ? 1 : 0,
            duration: 160,
            useNativeDriver: true,
        }).start();
    }, [sendMode, sendTransition]);

    if (assetConfig) {
        const microphoneRadius = assetSurfaceLayout.microphoneHeight / 2;
        const showAssetSend = sendMode && !!assetConfig.sendSource && !!assetConfig.sendArrowSource;
        const arrowSize = assetSurfaceLayout.microphoneHeight * 0.98 * 0.75;
        const arrowWidth = assetConfig.sendArrowBounds ? arrowSize * 690 / 1254 : arrowSize;
        const arrowHeight = assetConfig.sendArrowBounds ? arrowSize * 968 / 1254 : arrowSize;
        const handlePress = showAssetSend && onSendPress ? onSendPress : onPress;
        const sendSourceStyle = assetConfig.sendSourceBounds
            ? {
                width: assetSurfaceLayout.microphoneWidth * assetConfig.sendSourceBounds.sourceWidth / assetConfig.sendSourceBounds.width,
                height: assetSurfaceLayout.microphoneHeight * assetConfig.sendSourceBounds.sourceHeight / assetConfig.sendSourceBounds.height,
                left: -assetSurfaceLayout.microphoneWidth * assetConfig.sendSourceBounds.left / assetConfig.sendSourceBounds.width,
                top: -assetSurfaceLayout.microphoneHeight * assetConfig.sendSourceBounds.top / assetConfig.sendSourceBounds.height,
            }
            : {
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                width: undefined,
                height: undefined,
            };
        const sendArrowSourceStyle = assetConfig.sendArrowBounds
            ? {
                width: arrowWidth * assetConfig.sendArrowBounds.sourceWidth / assetConfig.sendArrowBounds.width,
                height: arrowHeight * assetConfig.sendArrowBounds.sourceHeight / assetConfig.sendArrowBounds.height,
                left: -arrowWidth * assetConfig.sendArrowBounds.left / assetConfig.sendArrowBounds.width,
                top: -arrowHeight * assetConfig.sendArrowBounds.top / assetConfig.sendArrowBounds.height,
            }
            : {
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                width: undefined,
                height: undefined,
            };

        return (
            <TouchableOpacity
                style={{
                    width: assetSurfaceLayout.microphoneWidth,
                    height: assetSurfaceLayout.microphoneHeight,
                    marginVertical: assetSurfaceLayout.microphoneMarginVertical,
                    marginLeft: microphoneSide === 'left'
                        ? assetSurfaceLayout.microphoneMarginRight
                        : assetSurfaceLayout.microphoneMarginLeft,
                    marginRight: microphoneSide === 'left'
                        ? assetSurfaceLayout.microphoneMarginLeft
                        : assetSurfaceLayout.microphoneMarginRight,
                }}
                onPress={handlePress}
                onLongPress={onLongPress}
                onPressOut={onPressOut}
                delayLongPress={delayLongPress}
                disabled={isProcessing}
            >
                {isListening ? <GlowRing glowAnim={glowAnim} borderRadius={microphoneRadius} /> : null}
                <View
                    style={{
                        flex: 1,
                        borderRadius: microphoneRadius,
                        overflow: 'hidden',
                    }}
                >
                    <Animated.Image
                        source={assetConfig.microphoneSource}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            width: undefined,
                            height: undefined,
                            opacity: sendTransition.interpolate({
                                inputRange: [0, 1],
                                outputRange: [1, 0],
                            }),
                            transform: [{
                                scale: sendTransition.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 0.96],
                                }),
                            }],
                        }}
                        resizeMode="stretch"
                    />
                    {assetConfig.sendSource && assetConfig.sendArrowSource ? (
                        <Animated.View
                            pointerEvents="none"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                opacity: sendTransition,
                                transform: [{
                                    scale: sendTransition.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.96, 1],
                                    }),
                                }],
                            }}
                        >
                            <Image
                                source={assetConfig.sendSource}
                                style={{
                                    position: 'absolute',
                                    ...sendSourceStyle,
                                }}
                                resizeMode="stretch"
                            />
                            <View
                                style={{
                                    position: 'absolute',
                                    width: arrowWidth,
                                    height: arrowHeight,
                                    left: (assetSurfaceLayout.microphoneWidth - arrowWidth) / 2,
                                    top: (assetSurfaceLayout.microphoneHeight - arrowHeight) / 2,
                                    overflow: 'hidden',
                                }}
                            >
                                <Image
                                    source={assetConfig.sendArrowSource}
                                    style={{
                                        position: 'absolute',
                                        ...sendArrowSourceStyle,
                                    }}
                                    resizeMode="stretch"
                                />
                            </View>
                        </Animated.View>
                    ) : null}
                </View>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            style={{
                backgroundColor: 'transparent',
                borderRadius: 23.5,
                width: 72,
                height: 47,
                alignItems: 'center',
                justifyContent: 'center',
                margin: 10,
                borderColor: micStrokeColor,
                borderWidth: micStrokeWidth,
                overflow: 'visible',
            }}
            onPress={onPress}
            onLongPress={onLongPress}
            onPressOut={onPressOut}
            delayLongPress={delayLongPress}
            disabled={isProcessing}
        >
            {isListening ? <GlowRing glowAnim={glowAnim} borderRadius={23.5} /> : null}
            <LinearGradient
                colors={[micBgLeftColor ?? micBgColor, micBgColor]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: 23.5,
                }}
            />
            <View
                style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isProcessing ? 0.6 : 1,
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.35,
                    shadowRadius: 4,
                    elevation: 4,
                }}
            >
                <Image
                    source={require('../assets/images/ez-logo.png')}
                    style={{
                        width: 35,
                        height: 35,
                        tintColor: isListening ? microphoneColor : '#D5D3B9',
                    }}
                    resizeMode="contain"
                />
            </View>
        </TouchableOpacity>
    );
}

const AIInputBox: React.FC<AIInputBoxProps> = ({
    textInput,
    isListening,
    microphoneColor,
    glowAnim,
    placeholder,
    editable = false,
    showSoftInputOnFocus = editable,
    caretHidden = false,
    showSendButton,
    isProcessing = false,
    processingLabel = 'Processing...',
    inputRef,
    onChangeText,
    onSubmitEditing,
    onSendPress,
    voicePreviewContent,
    onFocus,
    onBlur,
    returnKeyType = 'done',
    autoCapitalize = 'sentences',
    blurOnSubmit,
    multiline = false,
    minInputHeight = 38,
    maxInputHeight = 120,
    onHeightChange,
    inputWrapper,
    surfaceVariant = 'default',
    onTextInputPress,
    onMicrophonePress,
    onMicrophoneLongPress,
    onMicrophonePressOut,
    microphoneDelayLongPress,
    microphoneWrapper,
    inputStrokeColor = '#000000',
    inputRingLeftColor = '#000000',
    inputRingRightColor = inputStrokeColor,
    inputBgLeftColor,
    inputBgColor = '#000000',
    inputStrokeTopColor,
    inputStrokeBottomColor,
    inputStrokeLeftColor,
    inputStrokeRightColor,
    inputStrokeWidth = 4,
    micBgLeftColor,
    micBgColor = 'transparent',
    micStrokeColor = 'transparent',
    micStrokeWidth = 0,
    microphoneSide = 'right',
    containerStyle,
}) => {
    const [inputHeight, setInputHeight] = useState(minInputHeight);
    const [localTextInput, setLocalTextInput] = useState(textInput);
    const reportedHeightRef = useRef(0);
    const contentHeightRef = useRef(minInputHeight);
    const assetConfig = surfaceVariant === 'default' ? undefined : assetSurfaceConfigs[surfaceVariant];
    const usesAssetSurface = !!assetConfig;
    const assetInputHeight =
        usesAssetSurface
            ? Math.max(minInputHeight - (surfaceVariant === 'allinity3d' ? 2 : 3), 0)
            : minInputHeight;
    const fieldHeight = usesAssetSurface
        ? assetInputHeight
        : multiline
          ? Math.min(Math.max(inputHeight, minInputHeight), maxInputHeight)
          : minInputHeight;
    const innerInputHeight = multiline ? fieldHeight : minInputHeight;
    const outerInputHeight = usesAssetSurface ? innerInputHeight : innerInputHeight + 4;
    const isExpandedMultiline = multiline && fieldHeight > minInputHeight;
    const fieldBorderRadius = multiline ? (usesAssetSurface ? 22 : 18) : 9999;
    const inputPaddingLeft = usesAssetSurface ? 2 : 10;
    const hasVoicePreviewContent = !!voicePreviewContent;
    const showsSendButton =
        !isProcessing &&
        !!onSendPress &&
        (
            (localTextInput.trim().length > 0 && (showSendButton ?? editable)) ||
            (hasVoicePreviewContent && showSendButton === true)
        );
    const showsAssetSendButton = showsSendButton && !!assetConfig?.sendSource && !!assetConfig.sendArrowSource;
    const showsInlineSendButton = showsSendButton && !showsAssetSendButton;
    const inputPaddingRight = showsInlineSendButton ? (usesAssetSurface ? 18 : 44) : (usesAssetSurface ? 2 : 10);
    const inputPaddingVertical = multiline ? (usesAssetSurface ? 2 : 9) : 0;
    const inputTextColor = assetConfig?.textColor ?? '#FFFFFF';
    const placeholderTextColor = assetConfig?.placeholderTextColor ?? '#FFFFFF';
    const lineHeight = assetConfig?.lineHeight ?? 18;
    const scrollsInternally = multiline && (usesAssetSurface || fieldHeight >= maxInputHeight);
    const showsProcessingState = isProcessing;
    const defaultSendButtonColors = [inputBgLeftColor ?? inputRingLeftColor, inputBgColor] as const;
    const defaultSendBorderColor =
        inputStrokeTopColor ??
        inputStrokeLeftColor ??
        (inputStrokeColor !== '#000000' ? inputStrokeColor : inputRingLeftColor);
    const defaultSendBorderWidth = defaultSendBorderColor === 'transparent' ? 0 : 1;
    const assetInputMarginLeft = microphoneSide === 'left'
        ? assetSurfaceLayout.inputMarginRight
        : assetSurfaceLayout.inputMarginLeft;
    const assetInputMarginRight = microphoneSide === 'left'
        ? assetSurfaceLayout.inputMarginLeft
        : assetSurfaceLayout.inputMarginRight;

    useEffect(() => {
        setLocalTextInput(textInput);
    }, [textInput]);

    useEffect(() => {
        if (!multiline || localTextInput) return;
        if (contentHeightRef.current !== minInputHeight) {
            contentHeightRef.current = minInputHeight;
            setInputHeight(minInputHeight);
        }
    }, [localTextInput, minInputHeight, multiline]);

    useEffect(() => {
        if (!onHeightChange) return;
        if (reportedHeightRef.current === outerInputHeight) return;
        reportedHeightRef.current = outerInputHeight;
        onHeightChange(outerInputHeight);
    }, [onHeightChange, outerInputHeight]);

    const sendButton = showsInlineSendButton ? (
        <SendButton
            assetConfig={assetConfig}
            defaultColors={defaultSendButtonColors}
            defaultBorderColor={assetConfig?.sendBorderColor ?? defaultSendBorderColor}
            defaultBorderWidth={defaultSendBorderWidth}
            isExpandedMultiline={isExpandedMultiline}
            onPress={onSendPress}
        />
    ) : null;

    const inputContent = hasVoicePreviewContent ? (
        <View
            style={{
                flex: 1,
                minWidth: 0,
                paddingLeft: inputPaddingLeft,
                paddingRight: inputPaddingRight,
                justifyContent: 'center',
                overflow: 'hidden',
            }}
        >
            {voicePreviewContent}
        </View>
    ) : showsProcessingState ? (
        <View
            style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                paddingLeft: inputPaddingLeft,
                paddingRight: inputPaddingRight,
                gap: 8,
            }}
        >
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text
                style={{
                    fontSize: usesAssetSurface ? 13 : 12,
                    lineHeight,
                    color: inputTextColor,
                }}
            >
                {processingLabel}
            </Text>
        </View>
    ) : (
        <TextInput
            ref={inputRef}
            style={{
                flex: 1,
                fontSize: usesAssetSurface ? 13 : 12,
                lineHeight,
                color: inputTextColor,
                paddingLeft: inputPaddingLeft,
                paddingRight: inputPaddingRight,
                paddingTop: inputPaddingVertical,
                paddingBottom: inputPaddingVertical,
                textAlignVertical: multiline ? 'top' : 'center',
            }}
            value={localTextInput}
            placeholder={placeholder}
            placeholderTextColor={placeholderTextColor}
            editable={editable}
            showSoftInputOnFocus={showSoftInputOnFocus}
            caretHidden={caretHidden}
            multiline={multiline}
            scrollEnabled={scrollsInternally}
            onPressIn={onTextInputPress}
            onChangeText={(nextText) => {
                setLocalTextInput(nextText);
                onChangeText?.(nextText);
            }}
            onSubmitEditing={onSubmitEditing}
            onContentSizeChange={(event) => {
                if (!multiline || usesAssetSurface) return;
                const nextHeight = Math.min(Math.max(event.nativeEvent.contentSize.height, minInputHeight), maxInputHeight);
                if (contentHeightRef.current === nextHeight) return;
                contentHeightRef.current = nextHeight;
                setInputHeight(nextHeight);
            }}
            onFocus={onFocus}
            onBlur={onBlur}
            returnKeyType={returnKeyType}
            autoCapitalize={autoCapitalize}
            autoCorrect={!isListening}
            blurOnSubmit={blurOnSubmit}
        />
    );

    const defaultInput = inputStrokeTopColor || inputStrokeBottomColor || inputStrokeLeftColor || inputStrokeRightColor ? (
        <View
            style={{
                height: innerInputHeight,
                borderRadius: fieldBorderRadius,
                marginRight: 10,
                marginLeft: 10,
                borderWidth: inputStrokeWidth,
                borderTopColor: inputStrokeTopColor ?? inputStrokeColor,
                borderBottomColor: inputStrokeBottomColor ?? inputStrokeColor,
                borderLeftColor: inputStrokeLeftColor ?? inputStrokeColor,
                borderRightColor: inputStrokeRightColor ?? inputStrokeColor,
                overflow: 'hidden',
            }}
        >
            <LinearGradient
                colors={[inputBgLeftColor ?? inputRingLeftColor, inputBgColor]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{
                    flex: 1,
                    borderRadius: fieldBorderRadius,
                    justifyContent: multiline ? 'flex-start' : 'center',
                }}
            >
                {inputContent}
                {sendButton}
            </LinearGradient>
        </View>
    ) : (
        <LinearGradient
            colors={[inputRingLeftColor, inputRingRightColor]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
                height: innerInputHeight,
                borderRadius: fieldBorderRadius,
                marginRight: 10,
                marginLeft: 10,
                padding: inputStrokeWidth,
            }}
        >
            <LinearGradient
                colors={[inputBgLeftColor ?? inputRingLeftColor, inputBgColor]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{
                    flex: 1,
                    borderRadius: fieldBorderRadius,
                    justifyContent: multiline ? 'flex-start' : 'center',
                }}
            >
                {inputContent}
                {sendButton}
            </LinearGradient>
        </LinearGradient>
    );

    const assetInput = assetConfig ? (
        <View
            style={{
                height: innerInputHeight,
                marginRight: assetInputMarginRight,
                marginLeft: assetInputMarginLeft,
                position: 'relative',
                overflow: 'visible',
            }}
        >
            <AssetSurface
                source={assetConfig.inputSource}
                style={{ flex: 1 }}
                contentStyle={{
                    justifyContent: multiline ? 'flex-start' : 'center',
                    marginRight: showsInlineSendButton ? 26 : 0,
                }}
            >
                {inputContent}
            </AssetSurface>
            {showsInlineSendButton ? (
                <SendButton
                    assetConfig={assetConfig}
                    defaultColors={defaultSendButtonColors}
                    defaultBorderColor={assetConfig.sendBorderColor}
                    defaultBorderWidth={defaultSendBorderWidth}
                    isExpandedMultiline={isExpandedMultiline}
                    bottomOffset={10}
                    onPress={onSendPress}
                    rightOffset={6}
                />
            ) : null}
        </View>
    ) : null;

    const inputNode = (
        <View style={{ flex: 1, justifyContent: 'center', height: outerInputHeight }}>
            {assetConfig ? assetInput : defaultInput}
        </View>
    );
    const wrappedInputNode = inputWrapper ? inputWrapper(inputNode) : inputNode;
    const microphoneNode = (
        <MicrophoneButton
            assetConfig={assetConfig}
            glowAnim={glowAnim}
            isListening={isListening}
            isProcessing={isProcessing}
            microphoneColor={microphoneColor}
            onPress={onMicrophonePress}
            onLongPress={onMicrophoneLongPress}
            onPressOut={onMicrophonePressOut}
            delayLongPress={microphoneDelayLongPress}
            onSendPress={onSendPress}
            sendMode={showsAssetSendButton}
            micBgLeftColor={micBgLeftColor}
            micBgColor={micBgColor}
            micStrokeColor={micStrokeColor}
            micStrokeWidth={micStrokeWidth}
            microphoneSide={microphoneSide}
        />
    );
    const wrappedMicrophoneNode = microphoneWrapper ? microphoneWrapper(microphoneNode) : microphoneNode;

    return (
        <View
            style={[
                {
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 10,
                    backgroundColor: 'transparent',
                },
                containerStyle,
            ]}
        >
            {microphoneSide === 'left' ? wrappedMicrophoneNode : wrappedInputNode}
            {microphoneSide === 'left' ? wrappedInputNode : wrappedMicrophoneNode}
        </View>
    );
};

export default AIInputBox;
