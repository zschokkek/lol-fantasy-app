// frontend/src/components/Navbar.js
import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  Box, Flex, Link, Heading, Spacer, Button, Menu, MenuButton, 
  MenuList, MenuItem, Avatar, useBreakpointValue,
  Drawer, DrawerOverlay, DrawerContent, DrawerCloseButton, 
  DrawerHeader, DrawerBody, useDisclosure, IconButton,
  HStack, VStack, Text, Divider
} from '@chakra-ui/react';
import { ChevronDownIcon, HamburgerIcon } from '@chakra-ui/icons';
import { useAuth } from '../context/AuthContext';
import { useLeague } from '../context/LeagueContext';

const NavLink = ({ to, children, isMobile = false }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      as={RouterLink}
      to={to}
      px={2}
      py={isMobile ? 3 : 1}
      rounded="md"
      fontWeight="medium"
      color={isActive ? "yellow.200" : "whiteAlpha.900"}
      _hover={{
        textDecoration: 'none',
        bg: "whiteAlpha.100",
        color: "white"
      }}
      transition="all 0.2s"
      position="relative"
      _after={isActive ? {
        content: '""',
        position: 'absolute',
        bottom: '-1px',
        left: '0',
        right: '0',
        height: '2px',
        bg: 'yellow.200',
        borderRadius: '2px 2px 0 0'
      } : {}}
      display={isMobile ? "block" : "inline-block"}
      width={isMobile ? "full" : "auto"}
    >
      {children}
    </Link>
  );
};

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { selectedLeague } = useLeague();
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [scrolled, setScrolled] = useState(false);
  
  const isMobile = useBreakpointValue({ base: true, md: false });
  
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const handleLogout = () => {
    logout();
    navigate('/login');
    if (isOpen) onClose();
  };
  
  const navItems = isAuthenticated ? [
    { label: 'Players', path: '/players', requiresLeague: true },
    { label: 'My Leagues', path: '/leagues', alwaysShow: true },
    { label: 'My Teams', path: '/teams', alwaysShow: true },
    { label: 'Matchups', path: '/matchups', requiresLeague: true },
    { label: 'Standings', path: '/standings', requiresLeague: true },
    { label: 'Draft', path: '/draft', requiresLeague: true },
  ] : [
    { label: 'Players', path: '/players', requiresLeague: true }
  ];
  
  // Filter nav items based on whether a league is selected
  const visibleNavItems = navItems.filter(item => 
    item.alwaysShow || (item.requiresLeague && selectedLeague)
  );
  
  return (
    <Box
      position="sticky"
      top="0"
      zIndex="sticky"
      bg={scrolled ? "rgba(26, 32, 44, 0.95)" : "gray.800"}
      backdropFilter={scrolled ? "blur(10px)" : "none"}
      boxShadow={scrolled ? "md" : "none"}
      transition="all 0.2s ease-in-out"
    >
      <Flex
        alignItems="center"
        maxW="container.xl"
        mx="auto"
        px={4}
        py={3}
      >
        <Flex alignItems="center">
          <Heading size="md" as={RouterLink} to="/" color="white">
            <Box as="span" color="yellow.300">Fantasy</Box> LoL
          </Heading>
          
          {selectedLeague && (
            <Flex
              alignItems="center"
              ml={3}
              pl={3}
              borderLeftWidth="1px"
              borderColor="gray.600"
            >
              <Text 
                color="yellow.300" 
                fontWeight="medium" 
                fontSize="md"
                display={{ base: 'none', sm: 'block' }}
              >
                {selectedLeague.name}
              </Text>
            </Flex>
          )}
        </Flex>
        
        <Spacer />
        
        {/* Desktop Navigation */}
        {!isMobile && (
          <HStack spacing={4} display={{ base: 'none', md: 'flex' }}>
            {visibleNavItems.map((item) => (
              <NavLink key={item.path} to={item.path}>
                {item.label}
              </NavLink>
            ))}
          </HStack>
        )}
        
        {/* Auth Controls */}
        <Box ml={4}>
          {isAuthenticated ? (
            <Menu>
              <MenuButton
                as={Button}
                rounded="full"
                variant="ghost"
                cursor="pointer"
                _hover={{ bg: 'whiteAlpha.200' }}
                color="white"
                rightIcon={<ChevronDownIcon />}
              >
                <Avatar size="sm" name={user.username} bg="yellow.400" src={user.avatar} />
              </MenuButton>
              <MenuList bg="gray.700" borderColor="gray.600">
                <Box px={3} py={2} borderBottomWidth="1px" borderColor="gray.600">
                  <Text color="white" fontWeight="medium">{user.username}</Text>
                  <Text color="gray.300" fontSize="sm">{user.email}</Text>
                </Box>
                {selectedLeague && (
                  <Box px={3} py={2} borderBottomWidth="1px" borderColor="gray.600">
                    <Text color="white" fontSize="sm" fontWeight="medium">Active League:</Text>
                    <Text color="yellow.300" fontSize="sm">{selectedLeague.name}</Text>
                  </Box>
                )}
                <MenuItem 
                  _hover={{ bg: 'gray.600' }} 
                  color="gray.200" 
                  as={RouterLink} 
                  to="/profile"
                >
                  Profile
                </MenuItem>
                <MenuItem 
                  _hover={{ bg: 'gray.600' }} 
                  color="gray.200"
                  onClick={handleLogout}
                >
                  Logout
                </MenuItem>
              </MenuList>
            </Menu>
          ) : (
            <HStack spacing={2}>
              <Button 
                as={RouterLink} 
                to="/login" 
                variant="ghost" 
                colorScheme="yellow"
                _hover={{ bg: 'whiteAlpha.200' }}
                color="white"
                size="sm"
              >
                Log In
              </Button>
              <Button 
                as={RouterLink} 
                to="/register" 
                colorScheme="yellow" 
                size="sm"
              >
                Register
              </Button>
            </HStack>
          )}
        </Box>
        
        {/* Mobile menu button */}
        {isMobile && (
          <IconButton
            aria-label="Open menu"
            variant="ghost"
            color="white"
            _hover={{ bg: 'whiteAlpha.200' }}
            icon={<HamburgerIcon />}
            display={{ md: 'none' }}
            onClick={onOpen}
            ml={2}
          />
        )}
      </Flex>
      
      {/* Mobile drawer */}
      <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="xs">
        <DrawerOverlay />
        <DrawerContent bg="gray.800">
          <DrawerCloseButton color="white" />
          <DrawerHeader borderBottomWidth="1px" borderColor="gray.700" color="white">
            Menu
          </DrawerHeader>
          <DrawerBody p={0}>
            <VStack spacing={0} align="stretch">
              {visibleNavItems.map((item) => (
                <Box key={item.path} onClick={onClose}>
                  <NavLink to={item.path} isMobile>
                    {item.label}
                  </NavLink>
                </Box>
              ))}
              
              <Divider borderColor="gray.700" />
              
              {isAuthenticated ? (
                <>
                  <Box px={4} py={2} borderBottomWidth="1px" borderColor="gray.700">
                    <Text color="white" fontWeight="medium">{user.username}</Text>
                    <Text color="gray.300" fontSize="sm">{user.email}</Text>
                  </Box>
                  {selectedLeague && (
                    <Box px={4} py={2} borderBottomWidth="1px" borderColor="gray.700">
                      <Text color="white" fontSize="sm" fontWeight="medium">Active League:</Text>
                      <Text color="yellow.300" fontSize="sm">{selectedLeague.name}</Text>
                    </Box>
                  )}
                  <Link
                    as={RouterLink}
                    to="/profile"
                    px={4}
                    py={3}
                    display="block"
                    color="white"
                    _hover={{ bg: 'whiteAlpha.100' }}
                    onClick={onClose}
                  >
                    Profile
                  </Link>
                  <Link
                    px={4}
                    py={3}
                    display="block"
                    color="white"
                    _hover={{ bg: 'whiteAlpha.100' }}
                    onClick={() => {
                      handleLogout();
                      onClose();
                    }}
                  >
                    Logout
                  </Link>
                </>
              ) : (
                <Box p={4}>
                  <VStack spacing={3}>
                    <Button 
                      as={RouterLink} 
                      to="/login" 
                      width="full"
                      variant="outline" 
                      colorScheme="yellow"
                      onClick={onClose}
                    >
                      Log In
                    </Button>
                    <Button 
                      as={RouterLink} 
                      to="/register" 
                      width="full"
                      colorScheme="yellow"
                      onClick={onClose}
                    >
                      Register
                    </Button>
                  </VStack>
                </Box>
              )}
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Box>
  );
};

export default Navbar;