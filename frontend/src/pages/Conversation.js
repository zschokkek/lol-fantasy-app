// frontend/src/pages/Conversation.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Heading, Text, Flex, Avatar, Input, Button, useToast,
  IconButton, VStack, HStack, Spinner, Divider
} from '@chakra-ui/react';
import { ArrowBackIcon, ArrowForwardIcon } from '@chakra-ui/icons';
import { useApi } from '../context/ApiContext';
import { useAuth } from '../context/AuthContext';

const Conversation = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [page, setPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { getConversation, getMessages, sendMessage, markConversationAsRead, loading } = useApi();
  const { user } = useAuth();
  const toast = useToast();
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  
  // Load conversation details
  const loadConversation = useCallback(async () => {
    try {
      const data = await getConversation(id);
      setConversation(data.conversation);
      
      // Mark conversation as read when opened
      await markConversationAsRead(id);
    } catch (error) {
      toast({
        title: 'Error loading conversation',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      navigate('/messages');
    }
  }, [getConversation, id, markConversationAsRead, navigate, toast]);
  
  // Load messages for the conversation
  const loadMessages = useCallback(async (pageNum = 1, append = false) => {
    try {
      setIsLoadingMore(pageNum > 1);
      const data = await getMessages(id, pageNum);
      
      if (data.messages) {
        if (append) {
          setMessages(prev => [...prev, ...data.messages]);
        } else {
          setMessages(data.messages);
        }
        
        // Check if there are more messages to load
        setHasMoreMessages(data.messages.length === 20); // Assuming page size of 20
      }
    } catch (error) {
      toast({
        title: 'Error loading messages',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [getMessages, id, toast]);
  
  // Initial load
  useEffect(() => {
    loadConversation();
    loadMessages();
    
    // Poll for new messages every 10 seconds
    const interval = setInterval(() => {
      loadMessages();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [id, loadConversation, loadMessages]);
  
  // Scroll to bottom when new messages are loaded (initial load)
  useEffect(() => {
    if (messages.length > 0 && page === 1) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, page]);
  
  // Format the timestamp for display
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Format the date for date separators
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString(undefined, { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };
  
  // Check if messages are from different days for date separators
  const shouldShowDateSeparator = (message, index) => {
    if (index === 0) return true;
    
    const currentDate = new Date(message.createdAt).toDateString();
    const prevDate = new Date(messages[index - 1].createdAt).toDateString();
    
    return currentDate !== prevDate;
  };
  
  // Get the other participant in the conversation
  const getOtherParticipant = () => {
    if (!conversation || !conversation.participants) return null;
    return conversation.participants.find(p => p._id !== user._id);
  };
  
  // Handle sending a new message
  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;
    
    try {
      await sendMessage(id, messageInput);
      setMessageInput('');
      
      // Reload messages to include the new one
      loadMessages();
    } catch (error) {
      toast({
        title: 'Failed to send message',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  // Load more messages (older ones)
  const handleLoadMore = () => {
    if (hasMoreMessages && !isLoadingMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadMessages(nextPage, true);
    }
  };
  
  // Get the other participant's details
  const otherUser = getOtherParticipant();
  
  return (
    <Box height="calc(100vh - 180px)" display="flex" flexDirection="column">
      {/* Header */}
      <Flex 
        align="center" 
        p={4} 
        borderBottom="1px solid" 
        borderColor="gray.700" 
        bg="gray.800"
        borderTopRadius="lg"
      >
        <IconButton
          icon={<ArrowBackIcon />}
          aria-label="Back to messages"
          variant="ghost"
          color="gray.300"
          mr={3}
          onClick={() => navigate('/messages')}
        />
        
        {otherUser ? (
          <Flex align="center">
            <Avatar 
              size="md" 
              name={otherUser.username} 
              bg="yellow.400" 
              src={otherUser.avatar} 
            />
            <Box ml={3}>
              <Heading size="md" color="white">{otherUser.username}</Heading>
              {otherUser.online && (
                <Text fontSize="sm" color="green.400">Online</Text>
              )}
            </Box>
          </Flex>
        ) : loading ? (
          <Spinner size="sm" color="yellow.400" ml={3} />
        ) : (
          <Text color="gray.400">Conversation</Text>
        )}
      </Flex>
      
      {/* Messages */}
      <Box 
        flex="1" 
        overflowY="auto" 
        p={4} 
        bg="gray.700"
        ref={messagesContainerRef}
      >
        {/* Load more button */}
        {hasMoreMessages && (
          <Flex justify="center" mb={4}>
            <Button
              size="sm"
              onClick={handleLoadMore}
              isLoading={isLoadingMore}
              variant="outline"
              borderColor="yellow.400"
              color="yellow.400"
              _hover={{ bg: 'yellow.500', color: 'white' }}
            >
              Load older messages
            </Button>
          </Flex>
        )}
        
        {loading && messages.length === 0 ? (
          <Flex justify="center" align="center" height="100%">
            <Spinner color="yellow.400" size="lg" />
          </Flex>
        ) : messages.length > 0 ? (
          <VStack spacing={4} align="stretch">
            {messages.map((message, index) => {
              const isCurrentUser = message.sender._id === user._id;
              const showDateSeparator = shouldShowDateSeparator(message, index);
              
              return (
                <React.Fragment key={message._id}>
                  {showDateSeparator && (
                    <Flex justify="center" my={4}>
                      <Text
                        px={3}
                        py={1}
                        borderRadius="full"
                        fontSize="xs"
                        color="gray.400"
                        bg="gray.800"
                      >
                        {formatDate(message.createdAt)}
                      </Text>
                    </Flex>
                  )}
                  
                  <Flex justify={isCurrentUser ? "flex-end" : "flex-start"}>
                    {!isCurrentUser && (
                      <Avatar
                        size="sm"
                        name={message.sender.username}
                        bg="yellow.400"
                        src={message.sender.avatar}
                        mr={2}
                        mt={1}
                      />
                    )}
                    
                    <Box
                      bg={isCurrentUser ? "yellow.500" : "gray.600"}
                      color={isCurrentUser ? "white" : "white"}
                      px={4}
                      py={2}
                      borderRadius="lg"
                      maxWidth="70%"
                    >
                      <Text>{message.content}</Text>
                      <Text fontSize="xs" color={isCurrentUser ? "yellow.200" : "gray.300"} textAlign="right">
                        {formatTimestamp(message.createdAt)}
                      </Text>
                    </Box>
                    
                    {isCurrentUser && (
                      <Avatar
                        size="sm"
                        name={user.username}
                        bg="yellow.400"
                        src={user.avatar}
                        ml={2}
                        mt={1}
                      />
                    )}
                  </Flex>
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
          </VStack>
        ) : (
          <Flex justify="center" align="center" height="100%">
            <Box textAlign="center">
              <Text color="gray.400">No messages yet.</Text>
              <Text color="gray.400" fontSize="sm">
                Send a message to start the conversation.
              </Text>
            </Box>
          </Flex>
        )}
      </Box>
      
      {/* Message Input */}
      <HStack 
        p={4} 
        bg="gray.800" 
        borderTop="1px solid" 
        borderColor="gray.700"
        borderBottomRadius="lg"
      >
        <Input
          placeholder="Type a message..."
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') handleSendMessage();
          }}
          bg="gray.700"
          color="white"
          borderColor="gray.600"
          _hover={{ borderColor: "yellow.400" }}
          _focus={{ borderColor: "yellow.400", boxShadow: "0 0 0 1px #ECC94B" }}
        />
        <IconButton
          icon={<ArrowForwardIcon />}
          colorScheme="yellow"
          aria-label="Send message"
          onClick={handleSendMessage}
          isDisabled={!messageInput.trim()}
          _hover={{ bg: 'yellow.500' }}
        />
      </HStack>
    </Box>
  );
};

export default Conversation;
