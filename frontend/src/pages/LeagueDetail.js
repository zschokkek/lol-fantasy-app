import React, { useEffect, useState } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box, Heading, Text, Button, Flex, SimpleGrid, Link,
  Divider, Tabs, TabList, Tab, TabPanels, TabPanel,
  Badge, Spinner, useDisclosure, Modal, ModalOverlay,
  ModalContent, ModalHeader, ModalBody, ModalCloseButton,
  FormControl, FormLabel, Input, useToast, ModalFooter,
  HStack, VStack, Icon, Table, Thead, Tbody, Tr, Th, Td,
  Avatar, Grid, GridItem, Checkbox, CheckboxGroup, Stack,
  NumberInput, NumberInputField, NumberInputStepper,
  NumberIncrementStepper, NumberDecrementStepper, Select,
  Radio, RadioGroup, AlertDialog, AlertDialogBody,
  AlertDialogFooter, AlertDialogHeader, AlertDialogContent,
  AlertDialogOverlay, IconButton
} from '@chakra-ui/react';
import { 
  AddIcon, StarIcon, CheckIcon, CalendarIcon, 
  TimeIcon, InfoIcon, WarningIcon, SettingsIcon, RepeatIcon,
  ChevronLeftIcon
} from '@chakra-ui/icons';
import { useApi } from '../context/ApiContext';
import { useAuth } from '../context/AuthContext';
import { useLeague } from '../context/LeagueContext';

const TeamCard = ({ team }) => {
  const navigate = useNavigate();
  
  // Return placeholder UI if team is undefined
  if (!team) {
    return (
      <Box
        bg="gray.800"
        p={5}
        rounded="lg"
        shadow="lg"
        borderWidth={1}
        borderColor="gray.700"
        position="relative"
        overflow="hidden"
      >
        <Box position="absolute" top={0} left={0} right={0} height="3px" bg="gray.500" />
        <Text color="gray.500">Team data not available</Text>
      </Box>
    );
  }
  
  const handleCardClick = () => {
    // Only navigate if team has a valid ID
    if (team && team.id) {
      console.log('Navigating to team:', team.id);
      navigate(`/teams/${team.id}`);
    } else {
      console.log('Cannot navigate, team ID not available:', team);
    }
  };
  
  return (
    <Box
      bg="gray.800"
      p={5}
      rounded="lg"
      shadow="lg"
      borderWidth={1}
      borderColor="gray.700"
      transition="all 0.2s"
      _hover={{ 
        shadow: 'xl', 
        transform: 'translateY(-2px)', 
        borderColor: 'yellow.500', 
        cursor: 'pointer',
        bg: 'gray.750'
      }}
      position="relative"
      overflow="hidden"
      onClick={handleCardClick}
      role="group"
      aria-label={`View team: ${team.name}`}
      className="team-card"
    >
      {/* Top accent line */}
      <Box position="absolute" top={0} left={0} right={0} height="3px" bg="yellow.500" />
      
      <Flex justify="space-between" align="flex-start">
        <Heading size="md" mb={2} fontWeight="bold" color="white" _groupHover={{ color: 'yellow.300' }}>
          <Flex align="center">
            {team?.name || 'Unnamed Team'}
            <Text fontSize="xs" ml={2} fontWeight="normal" color="yellow.400">(click to view)</Text>
          </Flex>
        </Heading>
        <Badge colorScheme="yellow" fontSize="xs" px={2} py={1} rounded="full">
          {team?.players ? Object.values(team.players).filter(p => p !== null && !Array.isArray(p)).length : 0} Players
        </Badge>
      </Flex>
      
      <Text color="gray.400" fontSize="sm" mb={3}>
        Owner: {team.owner}
      </Text>
      
      <Divider borderColor="gray.700" my={3} />
      
      <Flex justify="space-between" align="center">
        <Text fontSize="sm" color="gray.500">Fantasy Points</Text>
        <Text fontWeight="bold" fontSize="xl" color="yellow.300">
          {team.totalPoints?.toFixed(1) || 0}
        </Text>
      </Flex>
    </Box>
  );
};

const MemberList = ({ members }) => {
  return (
    <Box bg="gray.800" p={5} rounded="lg" borderWidth="1px" borderColor="gray.700">
      <Heading size="md" mb={4}>League Members</Heading>
      <VStack spacing={3} align="stretch">
        {members.map((member, index) => (
          <Flex key={index} justify="space-between" align="center">
            <Flex align="center">
              <Avatar size="sm" name={member.username} mr={3} bg="yellow.500" />
              <Text fontWeight="medium">{member.username}</Text>
            </Flex>
            <Badge colorScheme={index === 0 ? "purple" : "gray"}>
              {index === 0 ? "Creator" : "Member"}
            </Badge>
          </Flex>
        ))}
      </VStack>
    </Box>
  );
};

const CreateTeamModal = ({ isOpen, onClose, onCreate, leagueId }) => {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createTeam, loading } = useApi();
  const { user } = useAuth();
  const toast = useToast();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a team name',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Include leagueId when creating a team
      const newTeam = await createTeam({ 
        name, 
        owner: user.username,
        leagueId
      });
      
      toast({
        title: 'Team Created',
        description: `${name} has been created successfully`,
        status: 'success',
        duration: 3000,
        position: 'top'
      });
      
      setName('');
      onClose();
      onCreate(newTeam);
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create team',
        status: 'error',
        duration: 3000,
        position: 'top'
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay backdropFilter="blur(10px)" />
      <ModalContent bg="gray.800" color="white" borderRadius="lg">
        <ModalHeader borderBottomWidth="1px" borderColor="gray.700">Create New Team</ModalHeader>
        <ModalCloseButton />
        <form onSubmit={handleSubmit}>
          <ModalBody py={6}>
            <Text mb={4} color="gray.400">
              You're creating a team in this league. After creating a team, you'll be able to participate in the draft and compete against other teams.
            </Text>
            
            <FormControl mb={4} isRequired>
              <FormLabel fontWeight="bold">Team Name</FormLabel>
              <Input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter a cool team name"
                bg="gray.700"
                borderColor="gray.600"
                _hover={{ borderColor: "yellow.300" }}
                _focus={{ borderColor: "yellow.300", boxShadow: "0 0 0 1px yellow.300" }}
              />
            </FormControl>
          </ModalBody>
          
          <ModalFooter borderTopWidth="1px" borderColor="gray.700">
            <Button variant="ghost" mr={3} onClick={onClose} _hover={{ bg: "whiteAlpha.100" }}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              colorScheme="yellow" 
              isLoading={loading}
              leftIcon={<AddIcon />}
            >
              Create Team
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

const JoinLeagueModal = ({ isOpen, onClose, onJoin, league }) => {
  const [teamName, setTeamName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!teamName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a team name',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await onJoin(teamName);
      setTeamName('');
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to join league',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent bg="gray.800" color="white">
        <ModalHeader>Join {league?.name || 'League'}</ModalHeader>
        <ModalCloseButton />
        <form onSubmit={handleSubmit}>
          <ModalBody pb={6}>
            <FormControl isRequired>
              <FormLabel>Team Name</FormLabel>
              <Input 
                placeholder="Enter your team name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </FormControl>
          </ModalBody>
          
          <ModalFooter>
            <Button 
              colorScheme="yellow" 
              mr={3} 
              type="submit"
              isLoading={isSubmitting}
            >
              Join
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

const ScheduleDraftModal = ({ isOpen, onClose, onSchedule, league }) => {
  const [draftDate, setDraftDate] = useState('');
  const [draftTime, setDraftTime] = useState('');
  const [draftType, setDraftType] = useState('snake');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!draftDate || !draftTime) {
      toast({
        title: 'Error',
        description: 'Please select a date and time for the draft',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Combine date and time
      const draftDateTime = new Date(`${draftDate}T${draftTime}`);
      
      await onSchedule(draftDateTime, draftType);
      setDraftDate('');
      setDraftTime('');
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to schedule draft',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent bg="gray.800" color="white">
        <ModalHeader>Schedule Draft for {league?.name || 'League'}</ModalHeader>
        <ModalCloseButton />
        <form onSubmit={handleSubmit}>
          <ModalBody pb={6}>
            <FormControl isRequired mb={4}>
              <FormLabel>Draft Date</FormLabel>
              <Input 
                type="date"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
              />
            </FormControl>
            
            <FormControl isRequired mb={4}>
              <FormLabel>Draft Time</FormLabel>
              <Input 
                type="time"
                value={draftTime}
                onChange={(e) => setDraftTime(e.target.value)}
              />
            </FormControl>
            
            <FormControl mb={4}>
              <FormLabel>Draft Type</FormLabel>
              <RadioGroup value={draftType} onChange={setDraftType}>
                <Stack direction="column">
                  <Radio value="snake">Snake Draft</Radio>
                  <Radio value="auction">Auction Draft</Radio>
                </Stack>
              </RadioGroup>
            </FormControl>
          </ModalBody>
          
          <ModalFooter>
            <Button 
              colorScheme="blue" 
              mr={3} 
              type="submit"
              isLoading={isSubmitting}
            >
              Schedule
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

const SetScheduleModal = ({ isOpen, onClose, onSetSchedule, league }) => {
  const [weeks, setWeeks] = useState(9);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (weeks < 1) {
      toast({
        title: 'Error',
        description: 'Please enter a valid number of weeks',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await onSetSchedule(weeks);
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to set league schedule',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent bg="gray.800" color="white">
        <ModalHeader>Set Schedule for {league?.name || 'League'}</ModalHeader>
        <ModalCloseButton />
        <form onSubmit={handleSubmit}>
          <ModalBody pb={6}>
            <FormControl isRequired>
              <FormLabel>Number of Weeks</FormLabel>
              <NumberInput 
                min={1} 
                max={20} 
                value={weeks}
                onChange={(valueString) => setWeeks(parseInt(valueString))}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
              <Text fontSize="sm" color="gray.400" mt={1}>
                This will generate a schedule for the specified number of weeks
              </Text>
            </FormControl>
          </ModalBody>
          
          <ModalFooter>
            <Button 
              colorScheme="green" 
              mr={3} 
              type="submit"
              isLoading={isSubmitting}
            >
              Generate Schedule
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

const FillLeagueModal = ({ isOpen, onClose, onFill, leagueId }) => {
  const [numTeams, setNumTeams] = useState(12);
  const [numWeeks, setNumWeeks] = useState(11);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onFill({ numTeams, numWeeks });
      onClose();
    } catch (error) {
      console.error('Error filling league:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent bg="gray.800" color="white">
        <ModalHeader borderBottomWidth="1px" borderColor="gray.700">
          Fill League with Teams
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody py={6}>
          <Text mb={4}>
            This will automatically create teams and generate a schedule for your league.
            This action is intended for testing purposes.
          </Text>
          
          <FormControl mb={4}>
            <FormLabel>Number of Teams</FormLabel>
            <NumberInput 
              min={2} 
              max={12} 
              value={numTeams}
              onChange={(valueString) => setNumTeams(parseInt(valueString))}
            >
              <NumberInputField bg="gray.700" />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </FormControl>
          
          <FormControl>
            <FormLabel>Number of Weeks</FormLabel>
            <NumberInput 
              min={1} 
              max={15} 
              value={numWeeks}
              onChange={(valueString) => setNumWeeks(parseInt(valueString))}
            >
              <NumberInputField bg="gray.700" />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </FormControl>
        </ModalBody>
        
        <ModalFooter borderTopWidth="1px" borderColor="gray.700">
          <Button variant="outline" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button 
            colorScheme="yellow" 
            onClick={handleSubmit}
            isLoading={isSubmitting}
            _hover={{ bg: 'yellow.500' }}
          >
            Fill League
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const LeagueDetail = () => {
  const { id } = useParams();
  const { getLeagueById, getStandings, getMatchups, joinLeague, createTeam, scheduleDraft, setSchedule, loading, error } = useApi();
  const [league, setLeague] = useState(null);
  const [standings, setStandings] = useState([]);
  const [matchups, setMatchups] = useState([]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const { user } = useAuth();
  const { selectLeague } = useLeague();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isJoinOpen, onOpen: onJoinOpen, onClose: onJoinClose } = useDisclosure();
  const { isOpen: isScheduleDraftOpen, onOpen: onScheduleDraftOpen, onClose: onScheduleDraftClose } = useDisclosure();
  const { isOpen: isSetScheduleOpen, onOpen: onSetScheduleOpen, onClose: onSetScheduleClose } = useDisclosure();
  const { isOpen: isFillLeagueOpen, onOpen: onFillLeagueOpen, onClose: onFillLeagueClose } = useDisclosure();
  const toast = useToast();
  const navigate = useNavigate();
  
  // State for handling loading and error states
  const [loadingLeague, setLoadingLeague] = useState(false);
  const [loadingError, setLoadingError] = useState(null);
  
  useEffect(() => {
    const fetchLeague = async () => {
      try {
        setLoadingLeague(true);
        // Log league ID for debugging
        console.log('Fetching league with ID:', id);
        
        const leagueData = await getLeagueById(id);
        // Log returned league data for debugging
        console.log('League data received:', leagueData);
        
        if (leagueData) {
          setLeague(leagueData);
          
          // Set this as the selected league in context
          selectLeague(leagueData);
          
          // Get standings
          try {
            const standingsData = await getStandings(id);
            setStandings(standingsData);
          } catch (err) {
            console.error('Error fetching standings:', err);
            // Non-critical error, just log it
          }
          
          // Get current week matchups
          try {
            const matchupsData = await getMatchups(id, currentWeek);
            setMatchups(matchupsData);
          } catch (err) {
            console.error('Error fetching matchups:', err);
            // Non-critical error, just log it
          }
        }
      } catch (error) {
        console.error('Error fetching league:', error);
        // Set a user-friendly error message
        let errorMessage = 'Failed to load league details';
        
        if (error.message.includes('HTML')) {
          errorMessage = 'The server is having trouble. Please try again later or contact support.';
        } else if (error.message.includes('Network')) {
          errorMessage = 'Network error. Please check your internet connection.';
        }
        
        setLoadingError(errorMessage);
        
        // Show error toast
        toast({
          title: 'Error Loading League',
          description: errorMessage,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setLoadingLeague(false);
      }
    };
    
    if (id) {
      fetchLeague();
    }
    
    // Cleanup function to clear selected league when leaving the page
    return () => {
      // Don't clear selected league when navigating to related pages
      // like matchups, standings, or draft
      const path = window.location.pathname;
      if (!path.includes('/matchups') && !path.includes('/standings') && !path.includes('/draft')) {
        selectLeague(null);
      }
    };
  }, [id, getLeagueById, getStandings, getMatchups, currentWeek, selectLeague]);

  const handleJoinLeague = async (teamName) => {
    if (!league) return;
    
    try {
      // Join the league first
      const response = await joinLeague(league.id, teamName);
      console.log('Join league response:', response);
      
      // If the response includes league data, use it directly
      if (response && response.league) {
        console.log('Using league data from join response');
        setLeague(response.league);
      } else {
        // Otherwise fetch fresh league data to ensure consistency
        console.log('Fetching fresh league data after join with refresh=true');
        const updatedLeague = await getLeagueById(league.id, true); // Force refresh
        
        console.log('Updated league data:', updatedLeague);
        // Set the complete updated league object
        setLeague(updatedLeague);
      }
      
      // Refresh standings data
      try {
        console.log('Refreshing standings data...');
        const standingsData = await getStandings(league.id);
        setStandings(standingsData);
      } catch (err) {
        console.error('Error fetching standings:', err);
      }
      
      toast({
        title: 'Success!',
        description: `You've joined ${league.name}`,
        status: 'success',
        duration: 3000,
        position: 'top'
      });
      
      // Close the join modal
      onJoinClose();
    } catch (error) {
      console.error('Error joining league:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to join league',
        status: 'error',
        duration: 3000,
        position: 'top'
      });
    }
  };
  
  const handleCreateTeam = async (newTeam) => {
    if (!league) return;
    
    try {
      // Always fetch fresh league data to ensure consistency
      console.log('Fetching fresh league data after team creation with refresh=true');
      const updatedLeague = await getLeagueById(league.id, true); // Force refresh
      
      console.log('Updated league data:', updatedLeague);
      // Set the complete updated league object
      setLeague(updatedLeague);
      
      // Refresh standings data
      try {
        console.log('Refreshing standings data...');
        const standingsData = await getStandings(league.id);
        setStandings(standingsData);
      } catch (err) {
        console.error('Error fetching standings:', err);
      }
    } catch (error) {
      console.error('Error updating league data after team creation:', error);
    }
  };
  
  const handleScheduleDraft = async (draftDateTime, draftType) => {
    if (!league) return;
    
    try {
      await scheduleDraft(league.id, draftDateTime, draftType);
      
      toast({
        title: 'Success!',
        description: `Draft scheduled for ${league.name}`,
        status: 'success',
        duration: 3000,
        position: 'top'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to schedule draft',
        status: 'error',
        duration: 3000,
        position: 'top'
      });
    }
  };
  
  const handleSetSchedule = async (weeks) => {
    if (!league) return;
    
    try {
      await setSchedule(league.id, weeks);
      
      toast({
        title: 'Success!',
        description: `Schedule set for ${league.name}`,
        status: 'success',
        duration: 3000,
        position: 'top'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to set schedule',
        status: 'error',
        duration: 3000,
        position: 'top'
      });
    }
  };
  
  const handleFillLeague = async ({ numTeams, numWeeks }) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/fill-league/${league.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ numTeams, numWeeks })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Error filling league');
      }
      
      toast({
        title: 'League filled successfully',
        description: data.message,
        status: 'success',
        duration: 5000,
        isClosable: true,
        position: 'top'
      });
      
      // Refresh league data
      const updatedLeague = await getLeagueById(id);
      setLeague(updatedLeague);
      
      // Refresh standings
      try {
        const standingsData = await getStandings(id);
        setStandings(standingsData);
      } catch (err) {
        console.error('Error fetching standings:', err);
      }
      
      // Refresh matchups
      try {
        const matchupsData = await getMatchups(id, currentWeek);
        setMatchups(matchupsData);
      } catch (err) {
        console.error('Error fetching matchups:', err);
      }
      
    } catch (error) {
      console.error('Error filling league:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fill league',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top'
      });
    }
  };

  const handleBack = () => {
    navigate('/leagues');
  };

  if (loading && !league) {
    return (
      <Flex justify="center" align="center" height="70vh" direction="column">
        <Spinner 
          thickness="4px"
          speed="0.65s"
          emptyColor="gray.700"
          color="yellow.500"
          size="xl"
          mb={4}
        />
        <Text color="gray.300">Loading league details...</Text>
      </Flex>
    );
  }
  
  if (error || !league) {
    return (
      <Flex justify="center" align="center" height="70vh" direction="column">
        <Box p={8} bg="gray.800" rounded="lg" borderWidth={1} borderColor="red.500" maxW="500px" textAlign="center">
          <WarningIcon boxSize={10} color="red.500" mb={4} />
          <Heading size="md" color="white" mb={4}>Error Loading League</Heading>
          <Text color="gray.300" mb={6}>
            {error?.includes('HTML') ? 
              'The server returned an unexpected response. This might be due to server maintenance or an internal error.' :
              error || 'League not found'}
          </Text>
          <Button
            leftIcon={<RepeatIcon />}
            colorScheme="yellow"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </Box>
      </Flex>
    );
  }
  
  const isUserMember = league.memberIds?.includes(user.id);
  const userHasTeam = league.teams?.some(team => team.userId === user.id);
  
  // Check if user is the admin (creator or first member)
  const isAdmin = user.id === league.creatorId || 
                 (league.memberIds && 
                  league.memberIds.length > 0 && 
                  league.memberIds[0] === user.id);
  
  // Simulated members data (would need to be provided from the API)
  const members = [
    { username: league.creatorId ? 'League Creator' : 'Admin', isCreator: true },
    ...(league.memberIds || [])
      .filter(id => id !== league.creatorId)
      .map(id => ({ username: `Member ${id.slice(0, 5)}` }))
  ];
  
  return (
    <Box>
      <Flex mb={4} align="center" justifyContent="flex-start" width="100%">
        <IconButton
          icon={<ChevronLeftIcon boxSize={6} />}
          aria-label="Back to leagues"
          variant="ghost"
          colorScheme="yellow"
          size="lg"
          onClick={handleBack}
          mr={2}
          _hover={{ bg: 'yellow.500', color: 'white' }}
          marginLeft={0}
        />
        <Text color="gray.400" fontSize="md">Back to Leagues</Text>
      </Flex>
      
      {/* League Header */}
      <Box 
        bg="gray.800" 
        p={6} 
        rounded="lg" 
        shadow="xl"
        borderWidth="1px"
        borderColor="gray.700"
        mb={8}
      >
        <Flex 
          justify="space-between" 
          align={{ base: "flex-start", md: "center" }}
          direction={{ base: "column", md: "row" }}
          gap={{ base: 4, md: 0 }}
        >
          <Box>
            <Heading size="xl" mb={2}>{league.name}</Heading>
            <Text color="gray.400">Created by {league.creatorId}</Text>
            {league.description && <Text mt={2}>{league.description}</Text>}
            
            {/* Display the regions */}
            {league.regions && league.regions.length > 0 && (
              <Box mt={3}>
                <Text fontWeight="semibold" mb={1}>Regions:</Text>
                <HStack spacing={2}>
                  {league.regions.map((region, idx) => {
                    // Map region codes to user-friendly names
                    const regionDisplayNames = {
                      'AMERICAS': 'Americas',
                      'EMEA': 'Europe, Middle East & Africa',
                      'CHINA': 'China',
                      'KOREA': 'Korea',
                      // Legacy mappings for backward compatibility
                      'LCS': 'North America',
                      'LEC': 'Europe',
                      'LCK': 'Korea',
                      'LPL': 'China',
                      'NORTH': 'LTA North',
                      'SOUTH': 'LTA South'
                    };
                    
                    return (
                      <Badge 
                        key={idx} 
                        colorScheme="yellow" 
                        fontSize="sm" 
                        px={2} 
                        py={1} 
                        borderRadius="full"
                        bg="yellow.400"
                        color="gray.800"
                      >
                        {regionDisplayNames[region] || region}
                      </Badge>
                    );
                  })}
                </HStack>
              </Box>
            )}
          </Box>
          <Button
            colorScheme="yellow"
            size="md"
            onClick={onJoinOpen}
            isLoading={loading}
            leftIcon={<AddIcon />}
          >
            Join
          </Button>
        </Flex>
        
        {/* Navigation buttons for league-related pages */}
        <Flex mt={4} gap={3} wrap="wrap">
          <Button
            as={RouterLink}
            to={`/${league.id}/players`}
            colorScheme="yellow"
            size="sm"
          >
            View Players
          </Button>
          
          <Button
            as={RouterLink}
            to="/standings"
            colorScheme="yellow"
            size="sm"
          >
            Standings
          </Button>
          
          <Button
            as={RouterLink}
            to="/matchups"
            colorScheme="yellow"
            size="sm"
          >
            Matchups
          </Button>
        </Flex>
        
        {/* Admin Actions */}
        {isAdmin && (
          <Box mt={6} p={4} bg="gray.700" rounded="md">
            <Heading size="sm" mb={3}>Admin Actions</Heading>
            <HStack spacing={4}>
              <Button 
                leftIcon={<CalendarIcon />} 
                colorScheme="blue" 
                size="sm"
                onClick={onScheduleDraftOpen}
              >
                Schedule Draft
              </Button>
              <Button 
                leftIcon={<CalendarIcon />} 
                colorScheme="green" 
                size="sm"
                onClick={onSetScheduleOpen}
              >
                Set Schedule
              </Button>
              {user && isAdmin && (
                <Button 
                  variant="outline" 
                  borderColor="yellow.400" 
                  color="yellow.400"
                  onClick={onFillLeagueOpen}
                  leftIcon={<SettingsIcon />}
                  _hover={{ bg: 'yellow.900' }}
                >
                  Admin: Fill League
                </Button>
              )}
            </HStack>
          </Box>
        )}
        
        <Grid templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }} gap={4} mt={6}>
          <GridItem>
            <VStack align="flex-start" spacing={0}>
              <Text fontSize="sm" color="gray.400">Teams</Text>
              <Text fontWeight="bold" fontSize="xl" color="white">
                {league.teams?.length || 0}/{league.maxTeams || 10}
              </Text>
            </VStack>
          </GridItem>
          
          <GridItem>
            <VStack align="flex-start" spacing={0}>
              <Text fontSize="sm" color="gray.400">Members</Text>
              <Text fontWeight="bold" fontSize="xl" color="white">
                {league.memberIds?.length || 0}
              </Text>
            </VStack>
          </GridItem>
          
          <GridItem>
            <VStack align="flex-start" spacing={0}>
              <Text fontSize="sm" color="gray.400">Current Week</Text>
              <Text fontWeight="bold" fontSize="xl" color="white">
                {league.currentWeek || 0}
              </Text>
            </VStack>
          </GridItem>
          
          <GridItem>
            <VStack align="flex-start" spacing={0}>
              <Text fontSize="sm" color="gray.400">Visibility</Text>
              <Flex align="center">
                <Icon 
                  as={league.isPublic ? CheckIcon : WarningIcon} 
                  color={league.isPublic ? "green.400" : "orange.400"}
                  mr={1}
                />
                <Text fontWeight="bold" fontSize="md" color="white">
                  {league.isPublic ? "Public" : "Private"}
                </Text>
              </Flex>
            </VStack>
          </GridItem>
        </Grid>
      </Box>
      
      {/* League Content */}
      <Grid templateColumns={{ base: "1fr", lg: "3fr 1fr" }} gap={8}>
        <GridItem>
          <Tabs variant="soft-rounded" colorScheme="yellow" isLazy>
            <TabList mb={8}>
              <Tab _selected={{ color: 'white', bg: 'yellow.500' }} color="gray.300">Teams</Tab>
              <Tab _selected={{ color: 'white', bg: 'yellow.500' }} color="gray.300">Standings</Tab>
              <Tab _selected={{ color: 'white', bg: 'yellow.500' }} color="gray.300">Matchups</Tab>
              <Tab _selected={{ color: 'white', bg: 'yellow.500' }} color="gray.300">Draft</Tab>
            </TabList>
            
            <TabPanels>
              <TabPanel px={0}>
                {league.teams && league.teams.length > 0 ? (
                  <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={6}>
                    {league.teams
                      // Filter out any null or undefined team objects
                      .filter(team => team !== null && team !== undefined)
                      .map((team, index) => {
                        // Ensure each team has an ID for navigation
                        const teamWithId = team.id ? team : { ...team, id: `temp-team-${index}` };
                        console.log('Rendering team:', teamWithId);
                        return (
                          <TeamCard key={teamWithId.id} team={teamWithId} />
                        );
                      })}
                  </SimpleGrid>
                ) : (
                  <Box 
                    p={8} 
                    bg="gray.800" 
                    rounded="lg" 
                    textAlign="center"
                    borderWidth="1px"
                    borderColor="gray.700"
                    shadow="xl"
                  >
                    <Icon as={InfoIcon} boxSize={12} color="gray.400" mb={4} />
                    <Heading size="md" mb={2} fontWeight="bold" color="white">No Teams Yet</Heading>
                    <Text color="gray.300" mb={6}>Be the first to create a team in this league</Text>
                    {isUserMember && !userHasTeam && (
                      <Button 
                        colorScheme="yellow" 
                        onClick={onOpen}
                        size="lg"
                        leftIcon={<AddIcon />}
                      >
                        Create First Team
                      </Button>
                    )}
                  </Box>
                )}
              </TabPanel>
              
              <TabPanel px={0}>
                <Box bg="gray.800" rounded="lg" overflow="hidden" borderWidth="1px" borderColor="gray.700">
                  <Table variant="simple">
                    <Thead bg="gray.900">
                      <Tr>
                        <Th color="gray.300">Rank</Th>
                        <Th color="gray.300">Team</Th>
                        <Th isNumeric color="gray.300">W</Th>
                        <Th isNumeric color="gray.300">L</Th>
                        <Th isNumeric color="gray.300">Points</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {standings.length > 0 ? (
                        standings.map((standing, index) => (
                          <Tr key={index} _hover={{ bg: "gray.700" }}>
                            <Td fontWeight="bold" color={index < 3 ? "yellow.300" : "white"}>
                              {index + 1}
                            </Td>
                            <Td>
                              {standing.team ? (
                                <Link as={RouterLink} to={`/teams/${standing.team.id}`} color="white" _hover={{ color: 'yellow.300' }}>
                                  {standing.team.name}
                                </Link>
                              ) : (
                                <Text color="gray.400">Unknown Team</Text>
                              )}
                            </Td>
                            <Td isNumeric color="green.400">{standing?.wins || 0}</Td>
                            <Td isNumeric color="red.400">{standing?.losses || 0}</Td>
                            <Td isNumeric fontWeight="bold">{standing?.totalPoints ? standing.totalPoints.toFixed(1) : '0.0'}</Td>
                          </Tr>
                        ))
                      ) : (
                        <Tr>
                          <Td colSpan={5} textAlign="center" py={8} color="gray.400">
                            No standings available yet
                          </Td>
                        </Tr>
                      )}
                    </Tbody>
                  </Table>
                </Box>
              </TabPanel>
              
              <TabPanel px={0}>
                <Box bg="gray.800" p={6} rounded="lg" borderWidth="1px" borderColor="gray.700">
                  <Flex justify="space-between" align="center" mb={6}>
                    <Text fontSize="xl" fontWeight="bold" color="white">Matchups for Week {currentWeek}</Text>
                    <HStack>
                      <Button 
                        size="sm" 
                        onClick={() => setCurrentWeek(prev => Math.max(1, prev - 1))}
                        isDisabled={currentWeek <= 1}
                        leftIcon={<TimeIcon />}
                        variant="ghost"
                        color="gray.300"
                        _hover={{ bg: "whiteAlpha.200" }}
                      >
                        Previous
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => setCurrentWeek(prev => prev + 1)}
                        isDisabled={currentWeek >= (league.schedule?.length || 0)}
                        rightIcon={<TimeIcon />}
                        variant="ghost"
                        color="gray.300"
                        _hover={{ bg: "whiteAlpha.200" }}
                      >
                        Next
                      </Button>
                    </HStack>
                  </Flex>
                  
                  {matchups.length > 0 ? (
                    <VStack spacing={4} align="stretch">
                      {matchups.map((matchup, i) => (
                        <Box 
                          key={i} 
                          p={4} 
                          bg="gray.700" 
                          rounded="md"
                          borderWidth="1px"
                          borderColor="gray.600"
                          shadow="md"
                          _hover={{ borderColor: 'yellow.300', transform: 'translateY(-2px)' }}
                          transition="all 0.2s"
                        >
                          <Grid templateColumns="1fr auto 1fr" gap={4} alignItems="center">
                            <GridItem>
                              <VStack align="flex-start">
                                <Text fontWeight="bold" color="white">{matchup.homeTeam.name}</Text>
                                <Text fontSize="sm" color="gray.400">{matchup.homeTeam.owner}</Text>
                              </VStack>
                            </GridItem>
                            
                            <GridItem textAlign="center">
                              <Badge colorScheme={matchup.completed ? "green" : "gray"} p={2}>
                                {matchup.completed ? (
                                  <Text fontWeight="bold">
                                    {matchup.homeScore.toFixed(1)} - {matchup.awayScore.toFixed(1)}
                                  </Text>
                                ) : (
                                  <Flex align="center">
                                    <CalendarIcon mr={1} />
                                    <Text>Upcoming</Text>
                                  </Flex>
                                )}
                              </Badge>
                            </GridItem>
                            
                            <GridItem>
                              <VStack align="flex-end">
                                <Text fontWeight="bold" color="white">{matchup.awayTeam.name}</Text>
                                <Text fontSize="sm" color="gray.400">{matchup.awayTeam.owner}</Text>
                              </VStack>
                            </GridItem>
                          </Grid>
                        </Box>
                      ))}
                    </VStack>
                  ) : (
                    <Box textAlign="center" py={8} color="gray.400">
                      <CalendarIcon boxSize={10} mb={4} />
                      <Text>No matchups scheduled for this week</Text>
                    </Box>
                  )}
                </Box>
              </TabPanel>
              
              <TabPanel px={0}>
                <Box bg="gray.800" p={6} rounded="lg" borderWidth="1px" borderColor="gray.700">
                  <Flex direction="column" align="center" justify="center" py={8}>
                    <Icon as={CalendarIcon} boxSize={12} color="gray.500" mb={4} />
                    <Heading size="md" mb={3} color="white">Draft</Heading>
                    <Text color="gray.400" textAlign="center" maxW="md" mb={6}>
                      The draft for this league has not been scheduled yet. Once scheduled, you'll be able to participate here.
                    </Text>
                    {league.memberIds?.includes(user.id) && (
                      <Button colorScheme="yellow" size="lg" as={RouterLink} to={`/draft?leagueId=${league.id}`}>
                        View Draft Details
                      </Button>
                    )}
                  </Flex>
                </Box>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </GridItem>
        
        {/* Sidebar */}
        <GridItem>
          <Box bg="gray.800" p={5} rounded="lg" borderWidth="1px" borderColor="gray.700">
            <Heading size="md" mb={4} color="white">League Members</Heading>
            <VStack spacing={3} align="stretch">
              {members.map((member, index) => (
                <Flex key={index} justify="space-between" align="center">
                  <Flex align="center">
                    <Avatar size="sm" name={member.username} mr={3} bg="yellow.500" />
                    <Text fontWeight="medium" color="white">{member.username}</Text>
                  </Flex>
                  <Badge colorScheme={index === 0 ? "purple" : "gray"}>
                    {index === 0 ? "Creator" : "Member"}
                  </Badge>
                </Flex>
              ))}
            </VStack>
          </Box>
        </GridItem>
      </Grid>
      
      <CreateTeamModal 
        isOpen={isOpen} 
        onClose={onClose} 
        onCreate={handleCreateTeam}
        leagueId={league.id}
      />
      
      <JoinLeagueModal 
        isOpen={isJoinOpen} 
        onClose={onJoinClose} 
        onJoin={handleJoinLeague}
        league={league}
      />
      
      <ScheduleDraftModal 
        isOpen={isScheduleDraftOpen} 
        onClose={onScheduleDraftClose} 
        onSchedule={handleScheduleDraft}
        league={league}
      />
      
      <SetScheduleModal 
        isOpen={isSetScheduleOpen} 
        onClose={onSetScheduleClose} 
        onSetSchedule={handleSetSchedule}
        league={league}
      />
      
      <FillLeagueModal 
        isOpen={isFillLeagueOpen} 
        onClose={onFillLeagueClose} 
        onFill={handleFillLeague}
        leagueId={league.id}
      />
    </Box>
  );
};

export default LeagueDetail;