'use client';
// Compile-time alias in the isolated .next-e2e build only. Never present in a normal build.
import {useState,type ReactNode} from 'react';
import {AuthContext} from '../src/components/auth/context';
export default function FixtureAuth({children}:{children:ReactNode}){const [authenticated,setAuthenticated]=useState(false);return <AuthContext.Provider value={{ready:true,authenticated,userId:authenticated?'fixture-user':null,login:()=>setAuthenticated(true),logout:async()=>{setAuthenticated(false);},getAccessToken:async()=>authenticated?'fixture-public-test-token':null}}>{children}</AuthContext.Provider>;}
