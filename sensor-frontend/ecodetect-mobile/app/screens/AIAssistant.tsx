import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAPI } from '../context/APIContext';
import apiService from '../services/apiService';
import Card from '../components/Card';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}
// Inpiration for converting the React frontend to React Native: https://medium.com/@gwen_faraday/converting-a-react-app-to-react-native-d7df17968fc6
const AIAssistant = () => {
  const { colors } = useTheme();
  const { sensorData, waterFlowData } = useAPI();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! I\'m EcoBot, your environmental assistant. How can I help you today?',
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<FlatList>(null);
  const [quickSuggestions] = useState([
    'How can I reduce my carbon footprint?',
    'What does the temperature reading mean?',
    'Is my water usage normal?',
    'How to improve air quality?'
  ]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSend = async () => {
    if (input.trim() === '') return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    // Add user message to chat
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Prepare query with current sensor data
      const query = {
        query: userMessage.text,
        user_id: 'mobile_user',
        location: 'Mobile App'
      };

      // Send to AI service
      const response = await apiService.queryAIAssistant(query);

      // Add bot reply to chat
      if (response.data && response.data.answer) {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: response.data.answer,
          sender: 'bot',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);
      } else {
        // Error handling
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: 'Sorry, I couldn\'t process your request. Please try again.',
          sender: 'bot',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error querying AI:', error);
      // Error handling
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, there was an error communicating with the server. Please try again later.',
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSuggestion = (suggestion: string) => {
    setInput(suggestion);
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageContainer,
        item.sender === 'user' ? styles.userMessage : styles.botMessage,
        { 
          backgroundColor: item.sender === 'user' 
            ? colors.primary + '20' // User message with opacity
            : colors.card
        }
      ]}
    >
      <Text style={[styles.messageText, { color: colors.text }]}>{item.text}</Text>
      <Text style={styles.timestamp}>
        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      {/* Current sensor data summary */}
      <Card title="Current Environmental Data" style={styles.dataSummaryCard}>
        <View style={styles.dataRow}>
          <View style={styles.dataItem}>
            <Text style={[styles.dataLabel, { color: colors.text }]}>Temperature:</Text>
            <Text style={[styles.dataValue, { color: colors.text }]}>
              {sensorData?.temperature !== null ? `${sensorData?.temperature.toFixed(1)}°C` : 'N/A'}
            </Text>
          </View>
          <View style={styles.dataItem}>
            <Text style={[styles.dataLabel, { color: colors.text }]}>Humidity:</Text>
            <Text style={[styles.dataValue, { color: colors.text }]}>
              {sensorData?.humidity !== null ? `${sensorData?.humidity.toFixed(1)}%` : 'N/A'}
            </Text>
          </View>
          <View style={styles.dataItem}>
            <Text style={[styles.dataLabel, { color: colors.text }]}>Water Flow:</Text>
            <Text style={[styles.dataValue, { color: colors.text }]}>
              {waterFlowData?.flow_rate !== undefined ? 
                `${waterFlowData?.flow_rate.toFixed(1)} L/min` : 'N/A'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Chat messages */}
      <FlatList
        ref={scrollViewRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Quick suggestions */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.suggestionsContainer}
        contentContainerStyle={styles.suggestionsContent}
      >
        {quickSuggestions.map((suggestion, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.suggestionButton, { backgroundColor: colors.primary + '30' }]}
            onPress={() => handleQuickSuggestion(suggestion)}
          >
            <Text style={[styles.suggestionText, { color: colors.primary }]}>{suggestion}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Input area */}
      <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.background }]}
          value={input}
          onChangeText={setInput}
          placeholder="Ask something about your environment..."
          placeholderTextColor={colors.text + '80'}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: colors.primary }]}
          onPress={handleSend}
          disabled={loading || input.trim() === ''}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dataSummaryCard: {
    margin: 10,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  dataItem: {
    flexDirection: 'column',
    padding: 5,
    alignItems: 'center',
    minWidth: '30%',
  },
  dataLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  dataValue: {
    fontSize: 14,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    padding: 10,
    paddingBottom: 20,
  },
  messageContainer: {
    padding: 12,
    borderRadius: 20,
    marginVertical: 6,
    maxWidth: '80%',
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 5,
  },
  botMessage: {
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 10,
    color: '#666',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  suggestionsContainer: {
    maxHeight: 50,
    marginHorizontal: 10,
  },
  suggestionsContent: {
    paddingHorizontal: 5,
  },
  suggestionButton: {
    padding: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  suggestionText: {
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    padding: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AIAssistant;