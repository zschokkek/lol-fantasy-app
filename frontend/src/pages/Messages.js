// frontend/src/pages/Messages.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Heading, Text, Flex, Stack, Avatar, Badge, Divider,
  useToast, Input, Button, HStack, IconButton, InputGroup, InputRightElement,
  VStack, Spinner
} from '@chakra-ui/react';
import { SearchIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { useApi } from '../context/ApiContext';
import { useAuth } from '../context/AuthContext';

const Messages = () => {
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const { getConversations, createConversation, searchUsers, loading } = useApi();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Load all conversations
  const loadConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(data.conversations || []);
    } catch (error) {
      toast({
        title: 'Error loading conversations',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [getConversations, toast]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Format the timestamp for display
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    
    // Check if the message was sent today
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Check if the message was sent in the last week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    if (date > oneWeekAgo) {
      const options = { weekday: 'short' };
      return date.toLocaleDateString(undefined, options);
    }
    
    // Otherwise show the date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Handle search for users to message
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const results = await searchUsers(searchQuery);
      setSearchResults(results.users || []);
    } catch (error) {
      toast({
        title: 'Search failed',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Create new conversation with a user
  const handleCreateConversation = async (userId) => {
    try {
      const response = await createConversation(userId);
      
      // Navigate to the new conversation
      if (response && response.conversation) {
        navigate(`/messages/${response.conversation._id}`);
      }
    } catch (error) {
      toast({
        title: 'Failed to create conversation',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Get the other participant in the conversation (not the current user)
  const getOtherParticipant = (conversation) => {
    if (!conversation.participants || conversation.participants.length < 2) return null;
    return conversation.participants.find(p => p._id !== user._id);
  };

  return (
    <Box>
      <Heading 
        mb={6} 
        fontSize="3xl" 
        bgGradient="linear(to-r, yellow.400, orange.300)" 
        bgClip="text"
      >
        Messages
      </Heading>

      {/* Search for users to message */}
      <Box mb={8} p={5} borderRadius="lg" bg="gray.700">
        <Heading size="md" mb={4} color="white">Start New Conversation</Heading>
        <InputGroup size="md" mb={4}>
          <Input
            pr="4.5rem"
            placeholder="Search for users to message"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            bg="gray.800"
            color="white"
            borderColor="gray.600"
            _hover={{ borderColor: "yellow.400" }}
            _focus={{ borderColor: "yellow.400", boxShadow: "0 0 0 1px #ECC94B" }}
          />
          <InputRightElement width="4.5rem">
            <Button 
              h="1.75rem" 
              size="sm" 
              onClick={handleSearch}
              isLoading={isSearching}
              colorScheme="yellow"
              _hover={{ bg: 'yellow.500' }}
            >
              <SearchIcon />
            </Button>
          </InputRightElement>
        </InputGroup>
        
        {searchResults.length > 0 ? (
          <Stack spacing={3} mt={2}>
            {searchResults.map(user => (
              <Flex 
                key={user._id} 
                align="center" 
                justify="space-between" 
                p={3} 
                borderRadius="md" 
                bg="gray.800"
              >
                <Flex align="center">
                  <Avatar size="sm" name={user.username} bg="yellow.400" src={user.avatar} />
                  <Box ml={3}>
                    <Text color="white" fontWeight="medium">{user.username}</Text>
                    <Text fontSize="sm" color="gray.400">{user.email}</Text>
                  </Box>
                </Flex>
                <Button 
                  size="sm" 
                  colorScheme="yellow" 
                  rightIcon={<ChevronRightIcon />}
                  onClick={() => handleCreateConversation(user._id)}
                  _hover={{ bg: 'yellow.500' }}
                >
                  Message
                </Button>
              </Flex>
            ))}
          </Stack>
        ) : searchQuery && !isSearching ? (
          <Text color="gray.400">No users found matching your search.</Text>
        ) : null}
      </Box>

      {/* List of Conversations */}
      <Box borderRadius="lg" bg="gray.700" p={5}>
        <Heading size="md" mb={4} color="white">Recent Conversations</Heading>
        
        {loading ? (
          <Flex justify="center" align="center" py={10}>
            <Spinner color="yellow.400" size="lg" />
          </Flex>
        ) : conversations.length > 0 ? (
          <Stack spacing={2} divider={<Divider borderColor="gray.600" />}>
            {conversations.map(conversation => {
              const otherUser = getOtherParticipant(conversation);
              const lastMessage = conversation.lastMessage || {};
              const hasUnread = conversation.unreadCount > 0;
              
              return (
                <Box
                  key={conversation._id}
                  as="button"
                  onClick={() => navigate(`/messages/${conversation._id}`)}
                  _hover={{ bg: 'gray.600' }}
                  borderRadius="md"
                  p={3}
                  textAlign="left"
                  bg={hasUnread ? "gray.600" : "gray.800"}
                  position="relative"
                >
                  <Flex align="center">
                    <Avatar 
                      size="md" 
                      name={otherUser?.username} 
                      bg="yellow.400" 
                      src={otherUser?.avatar} 
                    />
                    <Box ml={3} flex="1">
                      <Flex justify="space-between" align="center">
                        <Text color="white" fontWeight={hasUnread ? "bold" : "medium"}>
                          {otherUser?.username}
                        </Text>
                        {lastMessage.createdAt && (
                          <Text fontSize="xs" color="gray.400">
                            {formatTimestamp(lastMessage.createdAt)}
                          </Text>
                        )}
                      </Flex>
                      <Text 
                        fontSize="sm" 
                        color={hasUnread ? "white" : "gray.400"}
                        noOfLines={1}
                      >
                        {lastMessage.content || "No messages yet"}
                      </Text>
                    </Box>
                  </Flex>
                  
                  {/* Unread badge */}
                  {hasUnread && (
                    <Badge 
                      position="absolute" 
                      top="50%" 
                      right="12px" 
                      transform="translateY(-50%)"
                      colorScheme="yellow" 
                      borderRadius="full"
                    >
                      {conversation.unreadCount}
                    </Badge>
                  )}
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Box textAlign="center" py={6}>
            <Text color="gray.400">You don't have any conversations yet.</Text>
            <Text color="gray.400" fontSize="sm" mt={2}>
              Search for users above to start a conversation.
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Messages;
