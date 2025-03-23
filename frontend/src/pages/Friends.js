// frontend/src/pages/Friends.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Heading, Text, Flex, Stack, Button, Input, InputGroup, InputRightElement,
  Avatar, Badge, Divider, useToast, Tabs, TabList, Tab, TabPanels, TabPanel,
  HStack, IconButton, useColorModeValue, VStack, Spinner
} from '@chakra-ui/react';
import { SearchIcon, CheckIcon, CloseIcon, DeleteIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { useApi } from '../context/ApiContext';
import { useAuth } from '../context/AuthContext';

const Friends = () => {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const {
    getFriends,
    getFriendRequests,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    searchUsers,
    getConversations,
    createConversation,
    loading
  } = useApi();

  // Load friends and requests when component mounts
  const loadFriendsData = useCallback(async () => {
    try {
      const friendsData = await getFriends();
      const requestsData = await getFriendRequests();
      
      setFriends(friendsData.friends || []);
      setFriendRequests(requestsData.received || []);
      setSentRequests(requestsData.sent || []);
    } catch (error) {
      toast({
        title: 'Error loading friends',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [getFriends, getFriendRequests, toast]);

  // Load conversations data
  const loadConversations = useCallback(async () => {
    if (activeTabIndex === 3) { // Only load if Messages tab is active
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
    }
  }, [getConversations, toast, activeTabIndex]);

  useEffect(() => {
    loadFriendsData();
  }, [loadFriendsData]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, activeTabIndex]);

  // Check for tab query parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    
    if (tab === 'messages') {
      setActiveTabIndex(3);  // Index of the Messages tab
    }
  }, [location.search]);

  // Search for users
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
  
  // Send friend request
  const handleSendRequest = async (userId) => {
    try {
      await sendFriendRequest(userId);
      
      // Update sent requests list
      await loadFriendsData();
      
      // Remove user from search results
      setSearchResults(searchResults.filter(user => user._id !== userId));
      
      toast({
        title: 'Friend request sent',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Failed to send request',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  // Accept friend request
  const handleAcceptRequest = async (requestId) => {
    try {
      await acceptFriendRequest(requestId);
      await loadFriendsData();
      
      toast({
        title: 'Friend request accepted',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Failed to accept request',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  // Reject friend request
  const handleRejectRequest = async (requestId) => {
    try {
      await rejectFriendRequest(requestId);
      
      // Update requests list
      setFriendRequests(friendRequests.filter(req => req._id !== requestId));
      
      toast({
        title: 'Friend request rejected',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Failed to reject request',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  // Remove friend
  const handleRemoveFriend = async (friendId) => {
    try {
      await removeFriend(friendId);
      
      // Update friends list
      setFriends(friends.filter(friend => friend._id !== friendId));
      
      toast({
        title: 'Friend removed',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Failed to remove friend',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
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
        Friends & Messages
      </Heading>

      {/* Search for users */}
      <Box mb={8} p={5} borderRadius="lg" bg="gray.700">
        <Heading size="md" mb={4} color="white">Find Friends</Heading>
        <InputGroup size="md" mb={4}>
          <Input
            pr="4.5rem"
            placeholder="Search for users by username or email"
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
                <HStack spacing={2}>
                  <Button 
                    size="sm" 
                    colorScheme="yellow" 
                    isDisabled={sentRequests.some(req => req.recipient._id === user._id)}
                    onClick={() => handleSendRequest(user._id)}
                    _hover={{ bg: 'yellow.500' }}
                  >
                    {sentRequests.some(req => req.recipient._id === user._id) 
                      ? 'Request Sent' 
                      : 'Add Friend'}
                  </Button>
                  <Button 
                    size="sm" 
                    colorScheme="yellow" 
                    variant="outline"
                    rightIcon={<ChevronRightIcon />}
                    onClick={() => handleCreateConversation(user._id)}
                    _hover={{ bg: 'yellow.500', color: 'white' }}
                    borderColor="yellow.400"
                  >
                    Message
                  </Button>
                </HStack>
              </Flex>
            ))}
          </Stack>
        ) : searchQuery && !isSearching ? (
          <Text color="gray.400">No users found matching your search.</Text>
        ) : null}
      </Box>
      
      {/* Tabs for Friends, Requests, Sent, Messages */}
      <Tabs 
        variant="enclosed" 
        colorScheme="yellow" 
        bg="gray.700" 
        borderRadius="lg"
        onChange={(index) => setActiveTabIndex(index)}
      >
        <TabList borderBottomColor="gray.600">
          <Tab 
            color="gray.200" 
            _selected={{ color: "white", borderColor: "gray.600", borderBottomColor: "gray.700", bg: "gray.700" }}
          >
            My Friends {friends.length > 0 && `(${friends.length})`}
          </Tab>
          <Tab 
            color="gray.200" 
            _selected={{ color: "white", borderColor: "gray.600", borderBottomColor: "gray.700", bg: "gray.700" }}
          >
            Friend Requests {friendRequests.length > 0 && (
              <Badge ml={2} colorScheme="yellow" borderRadius="full">
                {friendRequests.length}
              </Badge>
            )}
          </Tab>
          <Tab 
            color="gray.200" 
            _selected={{ color: "white", borderColor: "gray.600", borderBottomColor: "gray.700", bg: "gray.700" }}
          >
            Sent Requests {sentRequests.length > 0 && `(${sentRequests.length})`}
          </Tab>
          <Tab 
            color="gray.200" 
            _selected={{ color: "white", borderColor: "gray.600", borderBottomColor: "gray.700", bg: "gray.700" }}
          >
            Messages
          </Tab>
        </TabList>
        
        <TabPanels>
          {/* Friends List */}
          <TabPanel>
            {friends.length > 0 ? (
              <Stack spacing={3}>
                {friends.map(friend => (
                  <Flex 
                    key={friend._id} 
                    align="center" 
                    justify="space-between" 
                    p={3} 
                    borderRadius="md" 
                    bg="gray.800"
                  >
                    <Flex align="center">
                      <Avatar size="md" name={friend.username} bg="yellow.400" src={friend.avatar} />
                      <Box ml={3}>
                        <Text color="white" fontWeight="medium">{friend.username}</Text>
                        <Text fontSize="sm" color="gray.400">{friend.email}</Text>
                      </Box>
                    </Flex>
                    <HStack>
                      <Button 
                        size="sm" 
                        colorScheme="yellow"
                        _hover={{ bg: 'yellow.500' }}
                        onClick={() => handleCreateConversation(friend._id)}
                      >
                        Message
                      </Button>
                      <IconButton
                        icon={<DeleteIcon />}
                        aria-label="Remove friend"
                        variant="outline"
                        borderColor="yellow.400"
                        _hover={{ bg: 'yellow.500', color: 'white' }}
                        onClick={() => handleRemoveFriend(friend._id)}
                      />
                    </HStack>
                  </Flex>
                ))}
              </Stack>
            ) : (
              <Box textAlign="center" py={6}>
                <Text color="gray.400">You don't have any friends yet.</Text>
                <Text color="gray.400" fontSize="sm" mt={2}>
                  Search for users to add them as friends.
                </Text>
              </Box>
            )}
          </TabPanel>
          
          {/* Friend Requests */}
          <TabPanel>
            {friendRequests.length > 0 ? (
              <Stack spacing={3}>
                {friendRequests.map(request => (
                  <Flex 
                    key={request._id} 
                    align="center" 
                    justify="space-between" 
                    p={3} 
                    borderRadius="md" 
                    bg="gray.800"
                  >
                    <Flex align="center">
                      <Avatar 
                        size="md" 
                        name={request.sender.username} 
                        bg="yellow.400" 
                        src={request.sender.avatar} 
                      />
                      <Box ml={3}>
                        <Text color="white" fontWeight="medium">{request.sender.username}</Text>
                        <Text fontSize="sm" color="gray.400">{request.sender.email}</Text>
                      </Box>
                    </Flex>
                    <HStack>
                      <IconButton
                        icon={<CheckIcon />}
                        aria-label="Accept request"
                        colorScheme="green"
                        onClick={() => handleAcceptRequest(request._id)}
                      />
                      <IconButton
                        icon={<CloseIcon />}
                        aria-label="Reject request"
                        colorScheme="red"
                        onClick={() => handleRejectRequest(request._id)}
                      />
                    </HStack>
                  </Flex>
                ))}
              </Stack>
            ) : (
              <Box textAlign="center" py={6}>
                <Text color="gray.400">You don't have any friend requests.</Text>
              </Box>
            )}
          </TabPanel>
          
          {/* Sent Requests */}
          <TabPanel>
            {sentRequests.length > 0 ? (
              <Stack spacing={3}>
                {sentRequests.map(request => (
                  <Flex 
                    key={request._id} 
                    align="center" 
                    justify="space-between" 
                    p={3} 
                    borderRadius="md" 
                    bg="gray.800"
                  >
                    <Flex align="center">
                      <Avatar 
                        size="md" 
                        name={request.recipient.username} 
                        bg="yellow.400" 
                        src={request.recipient.avatar} 
                      />
                      <Box ml={3}>
                        <Text color="white" fontWeight="medium">{request.recipient.username}</Text>
                        <Text fontSize="sm" color="gray.400">{request.recipient.email}</Text>
                      </Box>
                    </Flex>
                    <Text color="gray.400" fontSize="sm">
                      Request sent {new Date(request.createdAt).toLocaleDateString()}
                    </Text>
                  </Flex>
                ))}
              </Stack>
            ) : (
              <Box textAlign="center" py={6}>
                <Text color="gray.400">You haven't sent any friend requests.</Text>
              </Box>
            )}
          </TabPanel>

          {/* Messages Tab */}
          <TabPanel>
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
                  Connect with your friends to start messaging.
                </Text>
              </Box>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default Friends;
